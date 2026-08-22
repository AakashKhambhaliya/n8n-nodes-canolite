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

/**
 * Builds the postReceive hook for an asynchronous generate operation.
 *
 * Both endpoints answer a queued job ({ uid, status: "queued" }) with no output
 * URL. When the user enables "Wait for Completion", the returned hook polls the
 * matching status endpoint until the render is done (or failed / times out) and
 * replaces the item with the completed job — so the output carries image_url or
 * video_url.
 *
 * Parameterised by kind because image and video jobs are NOT interchangeable:
 * they are served from /v1/images/:uid and /v1/videos/:uid respectively, each
 * 404s for the other's uid, and they name their output field differently. A
 * single hard-coded image path silently broke every video render.
 *
 * `optionsParameter` names the collection holding the polling settings, since
 * each operation keeps its options under its own parameter name to avoid
 * collisions.
 *
 * When "Wait for Completion" is off, items pass through unchanged (the queued
 * response), leaving the caller to poll with the Get Status operation.
 */
export function pollForRenderCompletion(kind: RenderKind, optionsParameter = 'options') {
	const { path, urlField } = KIND_CONFIG[kind];

	return async function poll(
		this: IExecuteSingleFunctions,
		items: INodeExecutionData[],
	): Promise<INodeExecutionData[]> {
		const waitForCompletion = this.getNodeParameter(
			`${optionsParameter}.waitForCompletion`,
			false,
		) as boolean;
		if (!waitForCompletion) {
			return items;
		}

		const pollInterval = Math.max(
			250,
			this.getNodeParameter(`${optionsParameter}.pollInterval`, 2000) as number,
		);
		const maxPollAttempts = Math.max(
			1,
			this.getNodeParameter(`${optionsParameter}.maxPollAttempts`, 60) as number,
		);

		const credentials = await this.getCredentials('canoliteApi');
		const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');

		return Promise.all(
			items.map(async (item) => {
				const job = item.json as RenderJob;
				const uid = job?.uid;

				// Nothing to poll, or it's already resolved (e.g. a sync response).
				if (!uid || job[urlField] || TERMINAL_STATUSES.includes(job.status ?? '')) {
					return item;
				}

				let latest: RenderJob = job;
				for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
					await sleep(pollInterval);

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
						`Render ${uid} did not complete after ${maxPollAttempts} attempts`,
						{
							description:
								kind === 'video'
									? 'Video renders take far longer than images — encoding a few hundred frames can run for minutes. Raise "Max Poll Attempts" or "Poll Interval", or disable "Wait for Completion" and poll with the Get Status operation.'
									: 'Increase "Max Poll Attempts" or "Poll Interval", or disable "Wait for Completion" and poll with the Get Status operation.',
						},
					);
				}

				return { ...item, json: { ...latest } };
			}),
		);
	};
}
