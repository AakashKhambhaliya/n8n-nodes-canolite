import {
	NodeOperationError,
	sleep,
	type IExecuteSingleFunctions,
	type INodeExecutionData,
} from 'n8n-workflow';

interface RenderJob {
	uid?: string;
	status?: string;
	image_url?: string;
	video_url?: string;
	error?: string;
}

const TERMINAL_STATUSES = ['done', 'failed'];

/** Which family of render the job belongs to — they live on different paths. */
export type RenderKind = 'image' | 'video';

const KIND_CONFIG: Record<RenderKind, { path: string; urlField: keyof RenderJob }> = {
	image: { path: 'images', urlField: 'image_url' },
	video: { path: 'videos', urlField: 'video_url' },
};

/** Poll settings, already normalised to milliseconds. */
interface WaitBudget {
	pollIntervalMs: number;
	maxWaitMs: number;
}

/**
 * Polls one job until it reaches a terminal status or the wait budget is spent.
 *
 * The budget is a deadline rather than an attempt count so the last sleep never
 * overshoots it: with a 5s interval and 12s left, the final wait is 2s, not 5s.
 *
 * `timeoutHint` comes from the caller because the two blocking operations expose
 * different knobs — naming the wrong one in the error sends the user hunting for
 * a field their operation does not have.
 */
async function waitForJob(
	this: IExecuteSingleFunctions,
	kind: RenderKind,
	baseUrl: string,
	uid: string,
	seed: RenderJob,
	{ pollIntervalMs, maxWaitMs }: WaitBudget,
	timeoutHint: string,
): Promise<RenderJob> {
	const { path } = KIND_CONFIG[kind];
	const deadline = Date.now() + maxWaitMs;
	let latest = seed;

	while (true) {
		const remaining = deadline - Date.now();
		if (remaining <= 0) {
			break;
		}

		await sleep(Math.min(pollIntervalMs, remaining));

		latest = (await this.helpers.httpRequestWithAuthentication.call(this, 'canoliteApi', {
			method: 'GET',
			url: `${baseUrl}/v1/${path}/${encodeURIComponent(uid)}`,
			json: true,
		})) as RenderJob;

		if (TERMINAL_STATUSES.includes(latest.status ?? '')) {
			break;
		}
	}

	if (latest.status === 'failed') {
		throw new NodeOperationError(this.getNode(), `Render ${uid} failed`, {
			description: latest.error ?? 'The Canolite render job reported a failed status.',
		});
	}

	if (latest.status !== 'done') {
		throw new NodeOperationError(
			this.getNode(),
			`Render ${uid} did not complete within ${Math.round(maxWaitMs / 1000)}s`,
			{ description: timeoutHint },
		);
	}

	return latest;
}

/** Nothing to poll, or the job is already resolved (e.g. a sync image response). */
function isSettled(job: RenderJob | undefined, urlField: keyof RenderJob): boolean {
	return !job?.uid || Boolean(job[urlField]) || TERMINAL_STATUSES.includes(job.status ?? '');
}

/**
 * Builds the postReceive hook for a synchronous generate operation.
 *
 * Same polling machinery as above, with two deliberate differences: waiting is
 * unconditional (that is what the operation is for — the caller asked for a
 * finished file, not a job UID), and the budget is a plain wall-clock timeout in
 * seconds instead of interval x attempts. "Give up after 10 minutes" is a thing
 * a user can reason about; "120 attempts at 5000 ms" is arithmetic homework.
 *
 * The API itself has no synchronous video mode — encoding runs for minutes and
 * any reverse proxy in front of it would cut the request long before the render
 * finished — so the waiting happens here, on the n8n side, where the deadline is
 * ours to control. From the workflow's point of view the node blocks and hands
 * back the completed job, video_url included.
 *
 * `maxWaitParameter` and `pollIntervalParameter` are the parameter paths holding
 * the timeout and interval, both in seconds.
 */
export function waitForRenderCompletion(
	kind: RenderKind,
	maxWaitParameter: string,
	pollIntervalParameter: string,
	defaults: { maxWaitSeconds: number; pollIntervalSeconds: number },
) {
	const { urlField } = KIND_CONFIG[kind];
	const resource = kind === 'video' ? 'Video' : 'Image';

	return async function wait(
		this: IExecuteSingleFunctions,
		items: INodeExecutionData[],
	): Promise<INodeExecutionData[]> {
		const maxWaitSeconds = Math.max(
			1,
			this.getNodeParameter(maxWaitParameter, defaults.maxWaitSeconds) as number,
		);
		const pollIntervalSeconds = Math.max(
			1,
			this.getNodeParameter(pollIntervalParameter, defaults.pollIntervalSeconds) as number,
		);

		const credentials = await this.getCredentials('canoliteApi');
		const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');

		return Promise.all(
			items.map(async (item) => {
				const job = item.json as RenderJob;
				if (isSettled(job, urlField)) {
					return item;
				}

				const uid = job.uid as string;
				const latest = await waitForJob.call(
					this,
					kind,
					baseUrl,
					uid,
					job,
					{ pollIntervalMs: pollIntervalSeconds * 1000, maxWaitMs: maxWaitSeconds * 1000 },
					// Running out of time does not cancel anything server-side, so point
					// at the UID rather than leaving the render looking lost.
					`Raise "Max Wait Time (Seconds)". The job is still rendering on the server — ${resource} → Get Status with UID ${uid} can still collect it.`,
				);

				return { ...item, json: { ...latest } };
			}),
		);
	};
}
