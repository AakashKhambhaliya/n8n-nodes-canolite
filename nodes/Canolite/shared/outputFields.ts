import type { INodeProperties } from 'n8n-workflow';

/**
 * Shared output format/quality/scale options used by all image generation operations.
 *
 * Each field carries an "inherit" marker as its default — an empty string for
 * Format, 0 for the numbers — and the routing expressions below turn that into
 * `undefined` so the key is omitted from the request body entirely.
 *
 * That mapping is load-bearing, not cosmetic. The API validates these with a
 * schema where `format` must be one of the enum values and `quality`/`scale`
 * have a minimum of 1, so literally sending `format: ""` or `quality: 0` is a
 * 400, not a fallback. Only an absent key lets the server apply the template's
 * own output defaults.
 */
export const outputFields: INodeProperties[] = [
	{
		displayName: 'Format',
		name: 'format',
		type: 'options',
		options: [
			// An explicit listed option rather than a bare empty default, so the
			// "inherit" case is visible in the UI and is a real member of the enum.
			{ name: 'Template Default', value: '' },
			{ name: 'PNG', value: 'png' },
			{ name: 'JPEG', value: 'jpg' },
			{ name: 'WebP', value: 'webp' },
		],
		default: '',
		description: 'Output format. Leave as Template Default to use the template’s own setting.',
		routing: {
			send: {
				type: 'body',
				property: 'format',
				value: '={{ $value || undefined }}',
			},
		},
	},
	{
		displayName: 'Quality',
		name: 'quality',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, maxValue: 100 },
		description: 'Output quality 1-100. Leave at 0 to use the template’s own setting.',
		routing: {
			send: {
				type: 'body',
				property: 'quality',
				value: '={{ $value > 0 ? $value : undefined }}',
			},
		},
	},
	{
		displayName: 'Scale',
		name: 'scale',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, maxValue: 4 },
		description: 'Render scale factor 1-4. Leave at 0 to use the template’s own setting.',
		routing: {
			send: {
				type: 'body',
				property: 'scale',
				value: '={{ $value > 0 ? $value : undefined }}',
			},
		},
	},
];
