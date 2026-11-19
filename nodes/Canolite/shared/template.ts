import {
	NodeOperationError,
	type ILoadOptionsFunctions,
	type INodeListSearchResult,
	type INodeProperties,
	type ResourceMapperField,
	type ResourceMapperFields,
} from 'n8n-workflow';
import { canoliteGet } from './apiErrors';

/** A template object as the API reports it on GET /v1/templates/:id. */
interface TemplateField {
	name?: string;
	type?: string;
	default_value?: string | null;
}

interface TemplateResponse {
	template_id?: string;
	name?: string;
	has_video?: boolean;
	fields?: TemplateField[];
}

interface TemplateListResponse {
	templates?: Array<{
		template_id?: string;
		name?: string;
		width?: number;
		height?: number;
		has_video?: boolean;
	}>;
}

/**
 * The Template ID as an expression, usable wherever a request body needs it.
 *
 * Written defensively because the parameter is a resourceLocator: picking from
 * the list yields `{ mode, value }`, while an expression can just as easily
 * evaluate to a bare string. Reading `.value` off a string is `undefined`
 * rather than an error, so the `||` covers both without a type check.
 */
export const TEMPLATE_ID_EXPRESSION = '={{ $parameter.templateId.value || $parameter.templateId }}';

/** Same idea, for code paths (loadOptions / resourceMapping) rather than expressions. */
export function extractTemplateId(raw: unknown): string {
	if (typeof raw === 'string') return raw.trim();
	if (raw && typeof raw === 'object' && 'value' in raw) {
		return String((raw as { value?: unknown }).value ?? '').trim();
	}
	return '';
}

async function fetchTemplate(
	this: ILoadOptionsFunctions,
	templateId: string,
): Promise<TemplateResponse> {
	try {
		return await canoliteGet.call<ILoadOptionsFunctions, [string], Promise<TemplateResponse>>(
			this,
			`/v1/templates/${encodeURIComponent(templateId)}`,
		);
	} catch (error) {
		const e = error as NodeOperationError;
		throw new NodeOperationError(this.getNode(), `Could not load template "${templateId}": ${e.message}`, {
			description: e.description ?? 'Check that the Template ID and your Canolite credentials are correct.',
		});
	}
}

/** Same request, exported for the batch field dropdown in Canolite.node.ts. */
export const loadTemplate = fetchTemplate;

/**
 * Template picker.
 *
 * A resourceLocator rather than a plain string so the common case is choosing a
 * template by name from a searchable list — the ID mode is still there for
 * expressions and for IDs that arrive from earlier nodes.
 */
export const templateLocator: INodeProperties = {
	displayName: 'Template',
	name: 'templateId',
	type: 'resourceLocator',
	required: true,
	default: { mode: 'list', value: '' },
	description: 'The template to render. Its objects become the Fields below.',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchTemplates',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. tmpl_abc123',
		},
	],
};

/**
 * The dynamic part of the node: one labelled input per object in the chosen
 * template, fetched live from the API.
 *
 * The alternative — a repeating "Add Modification" list where you pick an object
 * from a dropdown and then guess which of Text / Image URL / Video URL applies —
 * made the user do the API's bookkeeping. Here the template decides what inputs
 * exist and what type each one is.
 */
export const templateFieldsMapper: INodeProperties = {
	displayName: 'Fields',
	name: 'fields',
	type: 'resourceMapper',
	noDataExpression: true,
	default: { mappingMode: 'defineBelow', value: null },
	required: true,
	typeOptions: {
		loadOptionsDependsOn: ['templateId.value'],
		resourceMapper: {
			resourceMapperMethod: 'getTemplateFieldSchema',
			mode: 'add',
			valuesLabel: 'Fields',
			fieldWords: { singular: 'field', plural: 'fields' },
			addAllFields: true,
			multiKeyMatch: false,
			supportAutoMap: true,
			noFieldsError:
				'This template has no editable objects. Name a layer in the Canolite editor to expose it here.',
		},
	},
};

/**
 * Canolite field types that map to a value the renderer swaps in, paired with
 * the modification property that carries it.
 */
const VALUE_PROPERTY: Record<string, string> = {
	text: 'text',
	image: 'image_url',
	video: 'video_url',
	// A shape has no content to replace, so its one useful override is its colour.
	shape: 'fill',
};

/** Extra per-object overrides, hidden until the user adds them. */
const TEXT_EXTRAS = [
	{ prop: 'fontSize', label: 'Font Size', type: 'number' as const },
	{ prop: 'fill', label: 'Colour', type: 'string' as const },
];

const VIDEO_EXTRAS = [
	{ prop: 'trim_start', label: 'Trim Start', type: 'number' as const },
	{ prop: 'trim_end', label: 'Trim End', type: 'number' as const },
	{ prop: 'start_at', label: 'Start At', type: 'number' as const },
	{ prop: 'volume', label: 'Volume', type: 'number' as const },
	{ prop: 'muted', label: 'Muted', type: 'boolean' as const },
	{ prop: 'loop', label: 'Loop', type: 'boolean' as const },
];

/**
 * Builds the mapper schema for the currently selected template.
 *
 * Field ids carry the target property after a pipe ("headline|text",
 * "clip|trim_start"). The mapper hands back a flat object keyed by id, and the
 * routing expression below splits that back into the API's modifications array.
 * Encoding it in the id keeps the whole thing declarative — no second lookup at
 * request time to remember what type "headline" was.
 */
export async function getTemplateFieldSchema(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const templateId = extractTemplateId(this.getNodeParameter('templateId', ''));
	if (!templateId) {
		return { fields: [], emptyFieldsNotice: 'Choose a template first to load its fields.' };
	}

	const template = await fetchTemplate.call(this, templateId);
	const source = Array.isArray(template?.fields) ? template.fields : [];
	const fields: ResourceMapperField[] = [];

	for (const field of source) {
		const name = field?.name;
		if (!name) continue;

		const kind = String(field.type ?? 'text').toLowerCase();
		const valueProperty = VALUE_PROPERTY[kind] ?? 'text';

		fields.push({
			id: `${name}|${kind in VALUE_PROPERTY ? kind : 'text'}`,
			displayName: name,
			required: false,
			defaultMatch: false,
			canBeUsedToMatch: false,
			display: true,
			type: 'string',
			// A shape's colour is an override, not content — keep it out of the way
			// until asked for, the same as the extras below.
			removed: kind === 'shape',
			defaultValue: field.default_value ?? undefined,
		});

		const extras = kind === 'video' ? VIDEO_EXTRAS : valueProperty === 'text' ? TEXT_EXTRAS : [];
		for (const extra of extras) {
			fields.push({
				id: `${name}|${extra.prop}`,
				displayName: `${name} — ${extra.label}`,
				required: false,
				defaultMatch: false,
				canBeUsedToMatch: false,
				display: true,
				type: extra.type,
				removed: true,
			});
		}
	}

	return {
		fields,
		emptyFieldsNotice:
			'This template has no editable objects. Name a layer in the Canolite editor to expose it here.',
	};
}

/** Searchable template list for the resourceLocator. */
export async function searchTemplates(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await canoliteGet.call<ILoadOptionsFunctions, [string], Promise<TemplateListResponse>>(
		this,
		'/v1/templates',
	);

	const templates = Array.isArray(response?.templates) ? response.templates : [];
	const needle = filter?.toLowerCase();
	// The Video resource can only render templates that contain a video layer,
	// so filter the list rather than letting the user pick one the API will
	// reject. `has_video` comes straight from the list endpoint.
	const videoOnly = this.getNodeParameter('resource', '') === 'video';

	return {
		results: templates
			.filter((template) => template?.template_id)
			.filter((template) => !videoOnly || template.has_video === true)
			.filter((template) => {
				if (!needle) return true;
				return `${template.name ?? ''} ${template.template_id}`.toLowerCase().includes(needle);
			})
			.map((template) => ({
				name: template.name
					? `${template.name} (${template.width}×${template.height})`
					: String(template.template_id),
				value: String(template.template_id),
			})),
	};
}

/**
 * Turns the mapper's flat { "headline|text": "Hi", "clip|volume": 0.5 } object
 * into the API's modifications array, grouping every property that targets the
 * same object into one entry.
 *
 * Shipped as an expression string so the operations stay declarative. Empty
 * values are dropped rather than sent: the API treats an absent key as "keep
 * whatever the template has", and sending "" would blank the layer instead.
 */
export const buildFieldsExpression = `(fields) => { const value = (fields && fields.value) || {}; const byName = {}; const order = []; const numeric = ['fontSize', 'trim_start', 'trim_end', 'start_at', 'volume']; const booleans = ['muted', 'loop']; Object.keys(value).forEach((key) => { const raw = value[key]; if (raw === null || raw === undefined || raw === '') return; const parts = String(key).split('|'); const prop = parts.length > 1 ? parts[parts.length - 1] : 'text'; const name = parts.length > 1 ? parts.slice(0, -1).join('|') : String(key); if (!byName[name]) { byName[name] = { name: name }; order.push(name); } const mod = byName[name]; if (prop === 'text') mod.text = String(raw); else if (prop === 'image') mod.image_url = String(raw); else if (prop === 'video') mod.video_url = String(raw); else if (prop === 'shape') mod.fill = String(raw); else if (numeric.indexOf(prop) !== -1) mod[prop] = Number(raw); else if (booleans.indexOf(prop) !== -1) mod[prop] = raw === true || raw === 'true'; else mod[prop] = raw; }); return order.map((n) => byName[n]); }`;
