import {
	NodeOperationError,
	sleep,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IN8nHttpFullResponse,
	type INodeExecutionData,
} from 'n8n-workflow';
import { apiError, parseBody } from './apiErrors';

interface RenderJob extends IDataObject {
	uid?: string;
	status?: string;
	image_url?: string;
	video_url?: string;
	error?: string;
	format?: string;
}

const TERMINAL_STATUSES = ['done', 'failed'];

/** Which family of render the job belongs to — they live on different paths. */
export type RenderKind = 'image' | 'video';

const KIND_CONFIG: Record<RenderKind, { path: string; urlField: 'image_url' | 'video_url' }> = {
	image: { path: 'images', urlField: 'image_url' },
	video: { path: 'videos', urlField: 'video_url' },
};

/** Poll settings, already normalised to milliseconds. */
interface WaitBudget {
	pollIntervalMs: number;
	maxWaitMs: number;
}

/** A poll can hit a restart or a proxy hiccup; only give up after this many in a row. */
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

async function baseUrlOf(this: IExecuteSingleFunctions): Promise<string> {
	const credentials = await this.getCredentials('canoliteApi');
	return String(credentials.baseUrl ?? '').replace(/\/+$/, '');
}

/** GET one job. Returns null on a transient failure (network, 5xx), throws on a real one. */
async function fetchJob(
	this: IExecuteSingleFunctions,
	kind: RenderKind,
	baseUrl: string,
	uid: string,
): Promise<RenderJob | null> {
	let response: IN8nHttpFullResponse;
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(this, 'canoliteApi', {
			method: 'GET',
			url: `${baseUrl}/v1/${KIND_CONFIG[kind].path}/${encodeURIComponent(uid)}`,
			json: true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		})) as IN8nHttpFullResponse;
	} catch {
		return null; // network error — retried by the caller
	}
	const status = Number(response.statusCode) || 0;
	if (status >= 500 || status === 429) return null;
	if (status >= 400) throw apiError(this.getNode(), status, response.body, response.headers);
	const { json } = parseBody(response.body);
	return (json as RenderJob) ?? null;
}

/**
 * Polls one job until it reaches a terminal status or the wait budget is spent.
 *
 * The budget is a deadline rather than an attempt count so the last sleep never
 * overshoots it: with a 5s interval and 12s left, the final wait is 2s, not 5s.
 */
async function waitForJob(
	this: IExecuteSingleFunctions,
	kind: RenderKind,
	baseUrl: string,
	uid: string,
	seed: RenderJob,
	{ pollIntervalMs, maxWaitMs }: WaitBudget,
	timeoutHint: string,
	failOnError: boolean,
): Promise<RenderJob> {
	const deadline = Date.now() + maxWaitMs;
	let latest = seed;
	let errors = 0;

	while (!TERMINAL_STATUSES.includes(latest.status ?? '')) {
		const remaining = deadline - Date.now();
		if (remaining <= 0) break;
		await sleep(Math.min(pollIntervalMs, remaining));

		const next = await fetchJob.call(this, kind, baseUrl, uid);
		if (!next) {
			errors += 1;
			if (errors >= MAX_CONSECUTIVE_POLL_ERRORS) {
				throw new NodeOperationError(
					this.getNode(),
					`Lost contact with Canolite while waiting for render ${uid}`,
					{
						description: `${MAX_CONSECUTIVE_POLL_ERRORS} status checks in a row failed. The job may still finish on the server — use Get Status with UID ${uid}.`,
					},
				);
			}
			continue;
		}
		errors = 0;
		latest = next;
	}

	if (latest.status === 'failed' && failOnError) {
		throw new NodeOperationError(this.getNode(), `Render ${uid} failed: ${latest.error ?? 'unknown error'}`, {
			description:
				'Common causes: an image_url or video_url the server could not download, or a template layer whose image cannot be loaded. Open the render in Canolite → Renders for details.',
		});
	}

	if (!TERMINAL_STATUSES.includes(latest.status ?? '')) {
		throw new NodeOperationError(
			this.getNode(),
			`Render ${uid} did not complete within ${Math.round(maxWaitMs / 1000)}s`,
			{ description: timeoutHint },
		);
	}

	return latest;
}

function budgetFrom(
	this: IExecuteSingleFunctions,
	maxWaitParameter: string,
	pollIntervalParameter: string,
	defaults: { maxWaitSeconds: number; pollIntervalSeconds: number },
): WaitBudget {
	const maxWaitSeconds = Math.max(
		1,
		Number(this.getNodeParameter(maxWaitParameter, defaults.maxWaitSeconds)) || defaults.maxWaitSeconds,
	);
	const pollIntervalSeconds = Math.max(
		1,
		Number(this.getNodeParameter(pollIntervalParameter, defaults.pollIntervalSeconds)) ||
			defaults.pollIntervalSeconds,
	);
	return { pollIntervalMs: pollIntervalSeconds * 1000, maxWaitMs: maxWaitSeconds * 1000 };
}

const resourceLabel = (kind: RenderKind) => (kind === 'video' ? 'Video' : 'Image');

/**
 * postReceive for operations that must hand back a finished job: Synchronous
 * video (the API has no server-side wait for video — encoding takes minutes and
 * would outlive any reverse proxy), and Get Status with "Wait for Completion".
 *
 * `enabledParameter`, when given, names a boolean that switches waiting on.
 */
export function waitForRenderCompletion(
	kind: RenderKind,
	maxWaitParameter: string,
	pollIntervalParameter: string,
	defaults: { maxWaitSeconds: number; pollIntervalSeconds: number },
	enabledParameter?: string,
	/** Synchronous Request fails the node on a failed render; Get Status just reports it. */
	failOnFailed = true,
) {
	const { urlField } = KIND_CONFIG[kind];

	return async function wait(
		this: IExecuteSingleFunctions,
		items: INodeExecutionData[],
	): Promise<INodeExecutionData[]> {
		if (enabledParameter && !this.getNodeParameter(enabledParameter, false)) return items;
		const budget = budgetFrom.call(this, maxWaitParameter, pollIntervalParameter, defaults);
		const baseUrl = await baseUrlOf.call(this);

		return Promise.all(
			items.map(async (item) => {
				const job = item.json as RenderJob;
				if (!job?.uid || job[urlField] || TERMINAL_STATUSES.includes(job.status ?? '')) {
					if (job?.status === 'failed' && failOnFailed) {
						throw new NodeOperationError(this.getNode(), `Render ${job.uid} failed: ${job.error ?? 'unknown error'}`);
					}
					return item;
				}
				const uid = job.uid;
				const latest = await waitForJob.call(
					this,
					kind,
					baseUrl,
					uid,
					job,
					budget,
					`Raise "Max Wait Time (Seconds)". The job is still rendering on the server — ${resourceLabel(kind)} → Get Status with UID ${uid} can still collect it.`,
					failOnFailed,
				);
				return { ...item, json: { ...latest } };
			}),
		);
	};
}

/**
 * postReceive for Batch with "Wait for Completion": polls every job in the
 * batch and returns one output item per job, in the order they were queued.
 * A failed job is returned with status "failed" and its error rather than
 * failing the whole batch, unless "Fail If Any Job Fails" is on.
 */
export function waitForBatch(kind: RenderKind, defaults: { maxWaitSeconds: number; pollIntervalSeconds: number }) {
	return async function waitBatch(
		this: IExecuteSingleFunctions,
		items: INodeExecutionData[],
	): Promise<INodeExecutionData[]> {
		if (!this.getNodeParameter('options.waitForCompletion', false)) return items;
		const budget = budgetFrom.call(this, 'options.maxWaitTime', 'options.pollInterval', defaults);
		const failOnAny = this.getNodeParameter('options.failIfAnyJobFails', false) as boolean;
		const baseUrl = await baseUrlOf.call(this);
		const deadline = Date.now() + budget.maxWaitMs;
		const out: INodeExecutionData[] = [];

		for (const item of items) {
			const batch = item.json as { batch_uid?: string; uids?: unknown };
			const uids = Array.isArray(batch.uids) ? batch.uids.map(String) : [];
			// Poll jobs concurrently, a few at a time, against one shared deadline.
			const results: RenderJob[] = new Array(uids.length);
			let next = 0;
			const worker = async () => {
				while (next < uids.length) {
					const index = next++;
					const uid = uids[index];
					const remaining = Math.max(1000, deadline - Date.now());
					results[index] = await waitForJob.call(
						this,
						kind,
						baseUrl,
						uid,
						{ uid, status: 'queued' },
						{ pollIntervalMs: budget.pollIntervalMs, maxWaitMs: remaining },
						`Raise "Max Wait Time (Seconds)". Batch ${batch.batch_uid ?? ''} is still rendering — Get Status can collect each job by UID.`,
						failOnAny,
					);
				}
			};
			await Promise.all(Array.from({ length: Math.min(5, uids.length) }, worker));
			for (const job of results) {
				out.push({ json: { ...job, batch_uid: batch.batch_uid }, pairedItem: item.pairedItem });
			}
		}
		return out;
	};
}

const EXTENSION_MIME: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	mp4: 'video/mp4',
};

/**
 * postReceive that downloads finished output into binary data, so the next
 * node (email, Drive, Slack…) can use the file directly.
 *
 * The API key is only sent when the file lives on the same origin as the
 * configured Base URL (needed when Canolite runs with MEDIA_ACCESS=private);
 * it is never sent to any other host.
 */
export function downloadOutput(kind: RenderKind) {
	const { urlField } = KIND_CONFIG[kind];

	return async function download(
		this: IExecuteSingleFunctions,
		items: INodeExecutionData[],
	): Promise<INodeExecutionData[]> {
		if (!this.getNodeParameter('options.download', false)) return items;
		const property = String(this.getNodeParameter('options.binaryPropertyName', 'data') || 'data');
		const baseUrl = await baseUrlOf.call(this);
		let baseOrigin = '';
		try {
			baseOrigin = new URL(baseUrl).origin;
		} catch {
			// Invalid Base URL — requests above would already have failed.
		}

		return Promise.all(
			items.map(async (item) => {
				const job = item.json as RenderJob;
				const url = job?.[urlField];
				if (job?.status !== 'done' || typeof url !== 'string' || !url) return item;

				let sameOrigin = false;
				try {
					sameOrigin = new URL(url).origin === baseOrigin;
				} catch {
					return item;
				}
				const request = { method: 'GET' as const, url, encoding: 'arraybuffer' as const, json: false };
				let data: Buffer;
				try {
					const body = sameOrigin
						? await this.helpers.httpRequestWithAuthentication.call(this, 'canoliteApi', request)
						: await this.helpers.httpRequest(request);
					data = Buffer.from(body as ArrayBuffer);
				} catch (error) {
					throw new NodeOperationError(this.getNode(), `Could not download ${url}`, {
						description: `${(error as Error).message}. If APP_URL in Canolite does not match the address n8n uses, set it to your public URL.`,
					});
				}
				const fileName = decodeURIComponent(new URL(url).pathname.split('/').pop() || `${job.uid}`);
				const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
				const binary = await this.helpers.prepareBinaryData(data, fileName, EXTENSION_MIME[extension]);
				return { ...item, binary: { ...(item.binary ?? {}), [property]: binary } };
			}),
		);
	};
}
