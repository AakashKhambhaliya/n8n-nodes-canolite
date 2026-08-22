import type { INodeProperties } from 'n8n-workflow';
import { buildModificationsExpression, modificationsCollection } from '../../shared/modifications';
import { videoOutputFields } from '../../shared/videoOutputFields';

const showOnlyForVideoGenerate = {
	operation: ['generate'],
	resource: ['video'],
};

export const videoGenerateDescription: INodeProperties[] = [
	{
		// There is no "Generate (Synchronous)" for video, unlike images, and its
		// absence is the first thing people look for. Say so here rather than
		// leaving them hunting: encoding runs for minutes, and holding an HTTP
		// request open that long dies at any reverse proxy long before the render
		// finishes. Waiting has to happen by polling, which is what the option
		// below does — from the workflow's point of view the node still blocks
		// and still hands back the finished URL.
		displayName:
			'Video renders are queued, so this returns a job UID rather than a file. For a single node that waits and outputs the finished video_url, enable “Wait for Completion” under Options.',
		name: 'asyncNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: showOnlyForVideoGenerate,
		},
	},
	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. tmpl_abc123',
		displayOptions: {
			show: showOnlyForVideoGenerate,
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
		...modificationsCollection,
		displayOptions: {
			show: showOnlyForVideoGenerate,
		},
		routing: {
			send: {
				type: 'body',
				property: 'modifications',
				value: `={{ (${buildModificationsExpression})($value.modification) }}`,
			},
		},
	},
	...videoOutputFields.map((field) => ({
		...field,
		displayOptions: {
			show: showOnlyForVideoGenerate,
		},
	})),
	{
		displayName: 'Options',
		name: 'videoOptions',
		type: 'collection',
		placeholder: 'Add Option',
		displayOptions: {
			show: showOnlyForVideoGenerate,
		},
		default: {},
		options: [
			{
				displayName: 'Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/webhook',
				description:
					'URL to notify when rendering completes or fails. Must be publicly reachable — the API rejects private and loopback addresses.',
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
				displayName: 'Poll Interval (Ms)',
				name: 'pollInterval',
				type: 'number',
				default: 5000,
				displayOptions: {
					show: {
						'/videoOptions/waitForCompletion': [true],
					},
				},
				description: 'How long to wait between polls in milliseconds',
			},
			{
				displayName: 'Max Poll Attempts',
				name: 'maxPollAttempts',
				type: 'number',
				default: 120,
				displayOptions: {
					show: {
						'/videoOptions/waitForCompletion': [true],
					},
				},
				description:
					'Maximum number of polling attempts before timing out. Video encoding is far slower than an image render, so this defaults higher than the image equivalent.',
			},
		],
	},
];
