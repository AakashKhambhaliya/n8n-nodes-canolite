import type {
	IExecuteSingleFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { checkApiResponse } from '../shared/apiErrors';
import { templateLocator } from '../shared/template';

/**
 * Template resource: read-only access to GET /v1/templates and
 * GET /v1/templates/:id, so a workflow can discover templates and their
 * editable fields (e.g. to build modifications dynamically).
 */

/** Unwraps `{ templates: [...] }` into one item per template, then filters and limits. */
async function splitTemplates(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', false) as boolean;
	const limit = returnAll ? Infinity : Math.max(1, Number(this.getNodeParameter('limit', 50)) || 50);
	const filters = this.getNodeParameter('filters', {}) as { search?: string; videoOnly?: boolean };
	const needle = (filters.search ?? '').trim().toLowerCase();

	const out: INodeExecutionData[] = [];
	for (const item of items) {
		const list = Array.isArray(item.json.templates) ? item.json.templates : [];
		for (const template of list as Array<Record<string, unknown>>) {
			if (filters.videoOnly && template.has_video !== true) continue;
			if (needle && !`${template.name ?? ''} ${template.template_id ?? ''}`.toLowerCase().includes(needle)) continue;
			out.push({ json: template as INodeExecutionData['json'], pairedItem: item.pairedItem });
			if (out.length >= limit) return out;
		}
	}
	return out;
}

export const templateOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: {
		show: { resource: ['template'] },
	},
	options: [
		{
			name: 'Get',
			value: 'get',
			action: 'Get a template',
			description: 'Get one template, including its editable fields',
			routing: {
				request: {
					method: 'GET',
					url: '=/v1/templates/{{ encodeURIComponent(String($parameter.templateId.value || $parameter.templateId).trim()) }}',
				},
				output: { postReceive: [checkApiResponse] },
			},
		},
		{
			name: 'Get Many',
			value: 'getAll',
			action: 'Get many templates',
			description: 'List the templates in the API key’s project',
			routing: {
				request: { method: 'GET', url: '=/v1/templates' },
				output: { postReceive: [checkApiResponse, splitTemplates] },
			},
		},
	],
	default: 'getAll',
};

export const templateProperties: INodeProperties[] = [
	templateOperations,
	{
		...templateLocator,
		displayOptions: {
			show: { resource: ['template'], operation: ['get'] },
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: { resource: ['template'], operation: ['getAll'] },
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: ['template'], operation: ['getAll'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: ['template'], operation: ['getAll'] },
		},
		options: [
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Only templates whose name or ID contains this text',
			},
			{
				displayName: 'Video Templates Only',
				name: 'videoOnly',
				type: 'boolean',
				default: false,
				description: 'Whether to return only templates that contain a video layer',
			},
		],
	},
];
