import type { INodeProperties } from 'n8n-workflow';
import { buildModificationsExpression, modificationFields } from '../shared/modifications';
import { outputFields } from '../shared/outputFields';
import { videoOutputFields } from '../shared/videoOutputFields';
import { waitForRenderCompletion } from '../shared/pollRender';
import {
	buildFieldsExpression,
	TEMPLATE_ID_EXPRESSION,
	templateFieldsMapper,
	templateLocator,
} from '../shared/template';

/**
 * The node reads as one straight line: Resource → Operation → Template → Fields.
 *
 * Image and Video offer the same four operations and differ only in what they
 * send, so the whole panel is built from shared properties gated by
 * displayOptions rather than duplicated per resource. Anything genuinely
 * different between the two — encoder settings, the batch cap, how the
 * synchronous operation actually waits — is isolated below and called out where
 * it appears.
 */

/** Operations that post a render and therefore need a template. */
const RENDER_OPERATIONS = ['single', 'sync', 'batch'];

const BOTH_RESOURCES = ['image', 'video'];

export const VIDEO_SYNC_DEFAULTS = {
	maxWaitSeconds: 600,
	pollIntervalSeconds: 5,
};

export const resourceSelector: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Image', value: 'image', description: 'Render a still from a template' },
		{
			name: 'Video',
			value: 'video',
			description: 'Render an MP4 from a template that contains a video layer',
		},
	],
	default: 'image',
};

const imageOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: {
		show: { resource: ['image'] },
	},
	options: [
		{
			name: 'Single Request',
			value: 'single',
			action: 'Generate an image',
			description: 'Queue one image and return its job UID straight away',
			routing: {
				request: { method: 'POST', url: '=/v1/images' },
			},
		},
		{
			name: 'Synchronous Request',
			value: 'sync',
			action: 'Generate an image and wait',
			description: 'Render one image and wait for the finished image_url',
			routing: {
				request: { method: 'POST', url: '=/v1/images' },
			},
		},
		{
			name: 'Batch Request',
			value: 'batch',
			action: 'Batch generate images',
			description: 'Queue up to 500 images from one template in a single request',
			routing: {
				request: { method: 'POST', url: '=/v1/images/batch' },
			},
		},
		{
			name: 'Get Status',
			value: 'getStatus',
			action: 'Get image render status',
			description: 'Look up a queued render by its job UID',
			routing: {
				request: { method: 'GET', url: '=/v1/images/{{$parameter.renderUid}}' },
			},
		},
	],
	default: 'single',
};

const videoOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: {
		show: { resource: ['video'] },
	},
	options: [
		{
			name: 'Single Request',
			value: 'single',
			action: 'Generate a video',
			description: 'Queue one video and return its job UID straight away',
			routing: {
				request: { method: 'POST', url: '=/v1/videos' },
			},
		},
		{
			name: 'Synchronous Request',
			value: 'sync',
			action: 'Generate a video and wait',
			description: 'Render one video and wait for the finished video_url',
			routing: {
				request: { method: 'POST', url: '=/v1/videos' },
				// Unlike images, this cannot be a server-side flag: encoding runs for
				// minutes and the request would die at any reverse proxy long before
				// the render finished. So POST /v1/videos still answers 202 with a
				// UID, and the node does the waiting here by polling — same result
				// from the workflow's point of view, on a deadline we control.
				output: {
					postReceive: [
						waitForRenderCompletion(
							'video',
							'maxWaitTime',
							'options.pollInterval',
							VIDEO_SYNC_DEFAULTS,
						),
					],
				},
			},
		},
		{
			name: 'Batch Request',
			value: 'batch',
			action: 'Batch generate videos',
			description: 'Queue up to 20 videos from one template in a single request',
			routing: {
				request: { method: 'POST', url: '=/v1/videos/batch' },
			},
		},
		{
			name: 'Get Status',
			value: 'getStatus',
			action: 'Get video render status',
			description: 'Look up a queued render by its job UID',
			routing: {
				request: { method: 'GET', url: '=/v1/videos/{{$parameter.renderUid}}' },
			},
		},
	],
	default: 'single',
};

const template: INodeProperties = {
	...templateLocator,
	displayOptions: {
		show: { resource: BOTH_RESOURCES, operation: RENDER_OPERATIONS },
	},
	routing: {
		send: { type: 'body', property: 'template_id', value: TEMPLATE_ID_EXPRESSION },
	},
};

const fields: INodeProperties = {
	...templateFieldsMapper,
	displayOptions: {
		// Batch needs one set of values per output, which a single mapper cannot
		// express, so it keeps the repeating Items list further down.
		show: { resource: BOTH_RESOURCES, operation: ['single', 'sync'] },
	},
	routing: {
		send: {
			type: 'body',
			property: 'modifications',
			value: `={{ (${buildFieldsExpression})($value) }}`,
		},
	},
};

const batchItems: INodeProperties = {
	displayName: 'Items',
	name: 'batchItems',
	type: 'fixedCollection',
	typeOptions: {
		multipleValues: true,
		multipleValueButtonText: 'Add Item',
	},
	placeholder: 'Add Item',
	displayOptions: {
		show: { resource: BOTH_RESOURCES, operation: ['batch'] },
	},
	default: {},
	description:
		'One output per item — up to 500 for images, 20 for videos. Each item lists the objects it overrides.',
	options: [
		{
			name: 'item',
			displayName: 'Item',
			values: [
				{
					// Batch is the one place the repeating Modifications list survives:
					// a resourceMapper describes one set of values, and a batch needs a
					// different set per output.
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
					description: 'URL to notify when this item finishes rendering',
				},
			],
		},
	],
	routing: {
		send: {
			type: 'body',
			property: 'items',
			value: `={{ ($value.item || []).map((i) => { const item = { modifications: (${buildModificationsExpression})(i.modifications && i.modifications.modification) }; if (i.webhook_url) item.webhook_url = i.webhook_url; return item; }) }}`,
		},
	},
};

const renderUid: INodeProperties = {
	displayName: 'Render UID',
	name: 'renderUid',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'e.g. img_abc123',
	displayOptions: {
		show: { resource: BOTH_RESOURCES, operation: ['getStatus'] },
	},
	description:
		'The job UID returned by a Single or Batch request. Image and video jobs are served from separate endpoints, so an img_ UID is not found under Video and a vid_ UID is not found under Image.',
};

/**
 * Image synchronicity is a real API flag: /v1/images renders inside the request
 * and answers 200 with the image_url. Hidden because choosing the operation is
 * already the user saying so.
 */
const imageSynchronousFlag: INodeProperties = {
	displayName: 'Synchronous',
	name: 'synchronous',
	type: 'hidden',
	default: true,
	displayOptions: {
		show: { resource: ['image'], operation: ['sync'] },
	},
	routing: {
		send: { type: 'body', property: 'synchronous' },
	},
};

const maxWaitTime: INodeProperties = {
	displayName: 'Max Wait Time (Seconds)',
	name: 'maxWaitTime',
	type: 'number',
	// Literal, not the constant above: the n8n lint rule that checks for a
	// default only recognises a literal here.
	default: 600,
	typeOptions: { minValue: 1, maxValue: 3600 },
	displayOptions: {
		show: { resource: ['video'], operation: ['sync'] },
	},
	description:
		'How long to wait for the render before failing the node. As a rough guide, a 15-second clip at 30fps takes a couple of minutes on modest hardware. If the wait runs out the job keeps rendering on the server — the error carries the UID, so Get Status can still collect it. Make sure the workflow’s own execution timeout is at least as generous.',
};

const options: INodeProperties = {
	displayName: 'Options',
	name: 'options',
	type: 'collection',
	placeholder: 'Add Option',
	displayOptions: {
		show: { resource: BOTH_RESOURCES, operation: RENDER_OPERATIONS },
	},
	default: {},
	options: [
		{
			displayName: 'Poll Interval (Seconds)',
			name: 'pollInterval',
			type: 'number',
			default: 5,
			typeOptions: { minValue: 1, maxValue: 300 },
			displayOptions: {
				show: { '/resource': ['video'], '/operation': ['sync'] },
			},
			description:
				'How often to check whether the render has finished. Only changes how quickly the node notices completion, not how fast the render runs.',
		},
		{
			displayName: 'Webhook URL',
			name: 'webhookUrl',
			type: 'string',
			default: '',
			placeholder: 'e.g. https://example.com/webhook',
			displayOptions: {
				// Batch carries a webhook per item instead — the batch endpoints have
				// no top-level webhook_url and reject one.
				show: { '/operation': ['single', 'sync'] },
			},
			description:
				'URL to notify when rendering completes or fails. Must be publicly reachable — the API rejects private and loopback addresses.',
			routing: {
				send: { type: 'body', property: 'webhook_url' },
			},
		},
	],
};

/** Encoder settings, scoped to the resource they belong to. */
const imageOutput = outputFields.map((field) => ({
	...field,
	displayOptions: {
		show: { resource: ['image'], operation: RENDER_OPERATIONS },
	},
}));

const videoOutput = videoOutputFields.map((field) => ({
	...field,
	displayOptions: {
		show: { resource: ['video'], operation: RENDER_OPERATIONS },
	},
}));

export const renderProperties: INodeProperties[] = [
	resourceSelector,
	imageOperations,
	videoOperations,
	template,
	fields,
	batchItems,
	renderUid,
	...imageOutput,
	...videoOutput,
	maxWaitTime,
	imageSynchronousFlag,
	options,
];
