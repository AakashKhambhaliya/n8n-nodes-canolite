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
	error?: string;
}

const TERMINAL_STATUSES = ['done', 'failed'];

/**
 * postReceive hook for the async "Generate" operation.
 *
 * The async endpoint returns a queued job ({ uid, status: "queued" }) without an
 * image_url. When the user enables "Wait for Completion", this polls
 * GET /v1/images/{uid} until the render is done (or failed / times out) and
 * replaces the item with the completed job — so the output carries image_url.
 *
 * When the option is off, items pass through unchanged (the queued response).
 */
export async function pollForRenderCompletion(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const waitForCompletion = this.getNodeParameter('options.waitForCompletion', false) as boolean;
	if (!waitForCompletion) {
		return items;
	}

	const pollInterval = Math.max(
		250,
		this.getNodeParameter('options.pollInterval', 2000) as number,
	);
	const maxPollAttempts = Math.max(1, this.getNodeParameter('options.maxPollAttempts', 60) as number);

	const credentials = await this.getCredentials('canoliteApi');
	const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');

	return Promise.all(
		items.map(async (item) => {
			const job = item.json as RenderJob;
			const uid = job?.uid;

			// Nothing to poll, or it's already resolved (e.g. a sync response).
			if (!uid || job.image_url || TERMINAL_STATUSES.includes(job.status ?? '')) {
				return item;
			}

			let latest: RenderJob = job;
			for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
				await sleep(pollInterval);

				latest = (await this.helpers.httpRequestWithAuthentication.call(this, 'canoliteApi', {
					method: 'GET',
					url: `${baseUrl}/v1/images/${encodeURIComponent(uid)}`,
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
							'Increase "Max Poll Attempts" or "Poll Interval", or disable "Wait for Completion" and poll with the Get Status operation.',
					},
				);
			}

			return { ...item, json: { ...latest } };
		}),
	);
}
