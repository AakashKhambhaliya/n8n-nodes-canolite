import type { INodeProperties } from 'n8n-workflow';
import { buildModificationsExpression, modificationsCollection } from '../../shared/modifications';
import { outputFields } from '../../shared/outputFields';

const showOnlyForImageGenerate = {
	operation: ['generate'],
	resource: ['image'],
};

export const imageGenerateDescription: INodeProperties[] = [
	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. tmpl_abc123',
		displayOptions: {
			show: showOnlyForImageGenerate,
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
			show: showOnlyForImageGenerate,
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
			show: showOnlyForImageGenerate,
		},
	})),
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		displayOptions: {
			show: showOnlyForImageGenerate,
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
			{
				displayName: 'Wait for Completion',
				name: 'waitForCompletion',
				type: 'boolean',
				default: false,
				description: 'Whether to automatically poll until the render is complete',
			},
			{
				displayName: 'Poll Interval (ms)',
				name: 'pollInterval',
				type: 'number',
				default: 2000,
				displayOptions: {
					show: {
						'/options/waitForCompletion': [true],
					},
				},
				description: 'How long to wait between polls in milliseconds',
			},
			{
				displayName: 'Max Poll Attempts',
				name: 'maxPollAttempts',
				type: 'number',
				default: 60,
				displayOptions: {
					show: {
						'/options/waitForCompletion': [true],
					},
				},
				description: 'Maximum number of polling attempts before timing out',
			},
		],
	},
];
