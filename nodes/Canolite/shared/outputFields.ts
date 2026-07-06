import type { INodeProperties } from 'n8n-workflow';

/**
 * Shared output format/quality/scale options used by all image generation operations.
 */
export const outputFields: INodeProperties[] = [
	{
		displayName: 'Format',
		name: 'format',
		type: 'options',
		options: [
			{ name: 'PNG', value: 'png' },
			{ name: 'JPEG', value: 'jpg' },
			{ name: 'WebP', value: 'webp' },
		],
		default: '',
		description: 'Output format (defaults to project setting if empty)',
		routing: {
			send: {
				type: 'body',
				property: 'format',
			},
		},
	},
	{
		displayName: 'Quality',
		name: 'quality',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 1, maxValue: 100 },
		description: 'Output quality 1-100 (defaults to project setting if 0)',
		routing: {
			send: {
				type: 'body',
				property: 'quality',
			},
		},
	},
	{
		displayName: 'Scale',
		name: 'scale',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 1, maxValue: 3 },
		description: 'Render scale factor 1-3 (defaults to project setting if 0)',
		routing: {
			send: {
				type: 'body',
				property: 'scale',
			},
		},
	},
];
