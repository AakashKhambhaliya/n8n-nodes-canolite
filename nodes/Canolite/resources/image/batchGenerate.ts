import type { INodeProperties } from 'n8n-workflow';
import { buildModificationsExpression, modificationFields } from '../../shared/modifications';
import { outputFields } from '../../shared/outputFields';

const showOnlyForBatchGenerate = {
	operation: ['batchGenerate'],
	resource: ['image'],
};

export const imageBatchGenerateDescription: INodeProperties[] = [
	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. tmpl_abc123',
		displayOptions: {
			show: showOnlyForBatchGenerate,
		},
		description: 'ID of the template to render',
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
			show: showOnlyForBatchGenerate,
		},
		default: {},
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
	...outputFields.map((field) => ({
		...field,
		displayOptions: {
			show: showOnlyForBatchGenerate,
		},
	})),
];
