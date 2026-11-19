import {
	NodeApiError,
	NodeOperationError,
	type IExecuteSingleFunctions,
	type IN8nHttpFullResponse,
	type INode,
	type INodeExecutionData,
	type JsonObject,
} from 'n8n-workflow';

/**
 * Turning Canolite's error responses into errors a workflow author can act on.
 *
 * Every Canolite error is JSON with an `error` string — e.g. "Remote image
 * returned HTTP 403" for a failed synchronous render, or "Validation error" plus
 * a `details` list for a bad body. n8n's default HTTP error handling throws that
 * body away and shows a generic per-status sentence ("Your request is invalid or
 * could not be processed by the service" for a 422), which tells the user
 * nothing. So the node asks n8n not to throw on HTTP status (`ignoreHttpStatusErrors`
 * in requestDefaults) and every operation runs `checkApiResponse` first.
 */

interface ApiErrorBody {
	error?: unknown;
	details?: unknown;
	uid?: unknown;
	status?: unknown;
	warnings?: unknown;
}

interface Explained {
	message: string;
	description: string;
}

function asText(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

/** Validation details arrive as `{field, message}` or as raw zod issues `{path, message}`. */
function formatDetails(details: unknown): string[] {
	if (!Array.isArray(details)) return [];
	return details
		.map((d) => {
			if (!d || typeof d !== 'object') return '';
			const entry = d as { field?: unknown; path?: unknown; message?: unknown };
			const where =
				asText(entry.field) || (Array.isArray(entry.path) ? entry.path.join('.') : '');
			const what = asText(entry.message);
			return where && what ? `${where}: ${what}` : what || where;
		})
		.filter(Boolean)
		.slice(0, 10);
}

export function formatWarnings(warnings: unknown): string[] {
	return Array.isArray(warnings) ? warnings.map(asText).filter(Boolean) : [];
}

/** Bodies can be a parsed object, a JSON string, or an HTML page from a proxy. */
export function parseBody(body: unknown): { json: ApiErrorBody | null; raw: string } {
	if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
		return { json: body as ApiErrorBody, raw: '' };
	}
	const raw = Buffer.isBuffer(body) ? body.toString('utf8') : typeof body === 'string' ? body : '';
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object') return { json: parsed as ApiErrorBody, raw };
	} catch {
		// Not JSON — usually an HTML error page from a reverse proxy.
	}
	return { json: null, raw };
}

function header(headers: IN8nHttpFullResponse['headers'] | undefined, name: string): string {
	if (!headers) return '';
	const value = (headers as Record<string, unknown>)[name];
	return Array.isArray(value) ? String(value[0] ?? '') : value === undefined ? '' : String(value);
}

/** One place that knows what each Canolite status means and what to do about it. */
export function explainApiError(
	statusCode: number,
	body: unknown,
	headers?: IN8nHttpFullResponse['headers'],
): Explained {
	const { json } = parseBody(body);
	const serverError = asText(json?.error);
	const details = formatDetails(json?.details);
	const warnings = formatWarnings(json?.warnings);
	const uid = asText(json?.uid);
	const extra = [
		...(details.length ? ['Details:', ...details.map((d) => `• ${d}`)] : []),
		...(warnings.length ? ['Warnings:', ...warnings.map((w) => `• ${w}`)] : []),
	];
	const withExtra = (text: string) => [text, ...extra].join('\n');

	if (!json) {
		return {
			message: `Canolite returned HTTP ${statusCode} with a non-JSON response`,
			description:
				'The response did not come from the Canolite API. Check that the Base URL in the credentials is the root of your Canolite instance (e.g. https://canolite.example.com, without /api or /v1) and that the server is running. A 502/504 from a reverse proxy (Coolify, Traefik, Nginx) means it could not reach Canolite or timed out — for slow renders use Single Request + Get Status instead of Synchronous Request.',
		};
	}

	switch (statusCode) {
		case 400:
			return {
				message: `Canolite rejected the request: ${serverError || 'invalid parameters'}`,
				description: withExtra('Check the fields and options sent by this node.'),
			};
		case 401:
			return {
				message: 'Canolite rejected the API key',
				description:
					'Check the API key in the Canolite credentials. It may have been revoked — create a new one under API Keys in Canolite.',
			};
		case 403:
			return {
				message: `Canolite refused access: ${serverError || 'forbidden'}`,
				description: withExtra('The API key is valid but cannot access this resource.'),
			};
		case 404:
			return {
				message: serverError || 'Not found',
				description: withExtra(
					'Check the template ID or render UID. Image (img_) and video (vid_) jobs live under different resources, and templates belong to the project of the API key used.',
				),
			};
		case 409:
			return { message: serverError || 'Conflict', description: withExtra('Retry the request.') };
		case 413:
			return {
				message: serverError || 'Request too large',
				description:
					'Canolite accepts render requests up to 4 MiB. Split large batches into several requests, or shorten very long text values.',
			};
		case 422:
			return {
				message: `Render failed: ${serverError || 'the server could not render this template'}`,
				description: withExtra(
					[
						uid ? `Render UID: ${uid}.` : '',
						'Common causes: an image_url or video_url the server could not download (the host blocked it, returned 403/404, or it is too large), or a template layer whose image cannot be loaded. Open the render in Canolite → Renders to see the same error.',
					]
						.filter(Boolean)
						.join(' '),
				),
			};
		case 429: {
			const retryAfter = header(headers, 'retry-after');
			return {
				message: `Canolite is busy: ${serverError || 'too many requests'}`,
				description: `Wait ${retryAfter ? `${retryAfter} seconds` : 'a moment'} and try again. Turn on "Retry On Fail" in this node's settings to retry automatically.`,
			};
		}
		default:
			if (statusCode >= 500) {
				return {
					message: `Canolite server error (HTTP ${statusCode})${serverError ? `: ${serverError}` : ''}`,
					description: withExtra('Check the Canolite server logs for details.'),
				};
			}
			return {
				message: `Canolite returned HTTP ${statusCode}${serverError ? `: ${serverError}` : ''}`,
				description: withExtra('Unexpected response from the Canolite API.'),
			};
	}
}

export function apiError(
	node: INode,
	statusCode: number,
	body: unknown,
	headers?: IN8nHttpFullResponse['headers'],
): NodeApiError {
	const { message, description } = explainApiError(statusCode, body, headers);
	const { json, raw } = parseBody(body);
	return new NodeApiError(node, (json ?? { body: raw.slice(0, 2000) }) as JsonObject, {
		message,
		description,
		httpCode: String(statusCode),
	});
}

/**
 * postReceive hook that must run first on every operation. Throws a readable
 * error for HTTP ≥ 400, rejects non-JSON success responses (wrong Base URL),
 * and — when "Fail on Warnings" is on — turns server warnings into errors.
 */
export async function checkApiResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const statusCode = Number(response.statusCode) || 0;
	if (statusCode >= 400) {
		throw apiError(this.getNode(), statusCode, response.body, response.headers);
	}

	const { json } = parseBody(response.body);
	if (!json) {
		throw new NodeOperationError(this.getNode(), 'Canolite returned a non-JSON response', {
			description:
				'Check that the Base URL in the credentials is the root of your Canolite instance (e.g. https://canolite.example.com, without /api or /v1).',
		});
	}

	const failOnWarnings = this.getNodeParameter('options.failOnWarnings', false) as boolean;
	const warnings = formatWarnings(json.warnings);
	if (failOnWarnings && warnings.length) {
		throw new NodeOperationError(this.getNode(), `Canolite reported ${warnings.length} warning(s)`, {
			description: warnings.map((w) => `• ${w}`).join('\n'),
		});
	}

	return items;
}
