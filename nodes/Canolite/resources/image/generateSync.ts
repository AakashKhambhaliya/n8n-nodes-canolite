import type { INodeProperties } from 'n8n-workflow';
import { buildModificationsExpression, modificationsCollection } from '../../shared/modifications';
import { outputFields } from '../../shared/outputFields';

const showOnlyForImageGenerateSync = {
	operation: ['generateSync'],
	resource: ['image'],
};

export const imageGenerateSyncDescription: INodeProperties[] = [
	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. tmpl_abc123',
		displayOptions: {
			show: showOnlyForImageGenerateSync,
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
		...modificationsCollection,
		displayOptions: {
			show: showOnlyForImageGenerateSync,
		},
		routing: {
			send: {
				type: 'body',
				property: 'modifications',
				value: `={{ (${buildModificationsExpression})($value.modification) }}`,
			},
		},
	},
	...outputFields.map((field) => ({
		...field,
		displayOptions: {
			show: showOnlyForImageGenerateSync,
		},
	})),
	{
		displayName: 'Options',
		name: 'syncOptions',
		type: 'collection',
		placeholder: 'Add Option',
		displayOptions: {
			show: showOnlyForImageGenerateSync,
		},
		default: {},
		options: [
			{
				displayName: 'Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/webhook',
				description: 'URL to notify when rendering completes or fails',
				routing: {
					send: {
						type: 'body',
						property: 'webhook_url',
					},
				},
			},
		],
	},
	// Always set synchronous: true for this operation
	{
		displayName: 'Synchronous',
		name: 'synchronous',
		type: 'hidden',
		default: true,
		displayOptions: {
			show: showOnlyForImageGenerateSync,
		},
		routing: {
			send: {
				type: 'body',
				property: 'synchronous',
			},
		},
	},
];
