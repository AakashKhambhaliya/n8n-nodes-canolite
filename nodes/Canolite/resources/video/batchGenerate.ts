import type { INodeProperties } from 'n8n-workflow';
import { buildModificationsExpression, modificationFields } from '../../shared/modifications';
import { videoOutputFields } from '../../shared/videoOutputFields';

const showOnlyForVideoBatchGenerate = {
	operation: ['batchGenerate'],
	resource: ['video'],
};

export const videoBatchGenerateDescription: INodeProperties[] = [
	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. tmpl_abc123',
		displayOptions: {
			show: showOnlyForVideoBatchGenerate,
		},
		description:
			'ID of the template to render. It must contain a video layer — the API rejects templates that do not.',
		routing: {
			send: {
				type: 'body',
				property: 'template_id',
			},
		},
	},
	{
		displayName: 'Items',
		name: 'batchItems',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
			multipleValueButtonText: 'Add Item',
		},
		placeholder: 'Add Batch Item',
		displayOptions: {
			show: showOnlyForVideoBatchGenerate,
		},
		default: {},
		// The video batch endpoint caps items at 20 (images allow 500) — video
		// renders are minutes of CPU each, not milliseconds.
		description: 'One output video per item, up to 20 per request',
		options: [
			{
				name: 'item',
				displayName: 'Item',
				values: [
					{
						displayName: 'Modifications',
						name: 'modifications',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
							multipleValueButtonText: 'Add Modification',
						},
						placeholder: 'Add Modification',
						default: {},
						options: [
							{
								name: 'modification',
								displayName: 'Modification',
								values: modificationFields,
							},
						],
					},
					{
						displayName: 'Webhook URL',
						name: 'webhook_url',
						type: 'string',
						default: '',
						placeholder: 'e.g. https://example.com/webhook',
						description: 'URL to notify when this item renders',
					},
				],
			},
		],
		routing: {
			send: {
				type: 'body',
				property: 'items',
				value: `={{ $value.item.map((i) => { const item = { modifications: (${buildModificationsExpression})(i.modifications && i.modifications.modification) }; if (i.webhook_url) item.webhook_url = i.webhook_url; return item; }) }}`,
			},
		},
	},
	...videoOutputFields.map((field) => ({
		...field,
		displayOptions: {
			show: showOnlyForVideoBatchGenerate,
		},
	})),
];
