import type { INodeProperties } from 'n8n-workflow';

/**
 * Encoder settings shared by single and batch video generation.
 *
 * Note these are NOT the image output fields. Video has no `format` (the output
 * is always H.264 MP4) and its `quality` is a named preset rather than the
 * 1-100 number images use — the API maps the preset to a CRF, so passing an
 * image-style number here would be read as a CRF and quietly wreck the output.
 */
export const videoOutputFields: INodeProperties[] = [
	{
		displayName: 'Frame Rate',
		name: 'fps',
		type: 'number',
		default: 30,
		typeOptions: { minValue: 1, maxValue: 60 },
		description: 'Frames per second of the output video (1-60)',
		routing: {
			send: {
				type: 'body',
				property: 'fps',
			},
		},
	},
	{
		displayName: 'Duration (Seconds)',
		name: 'duration',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, maxValue: 120 },
		description:
			'Length of the output video (max 120). Leave at 0 to derive it from the layers — the longest clip, or 5 seconds, whichever is greater.',
		routing: {
			send: {
				type: 'body',
				property: 'duration',
				// 0 is this field's "unset" marker; the API rejects it (minimum 0.1)
				// and derives the duration itself when the key is absent.
				value: '={{ $value > 0 ? $value : undefined }}',
			},
		},
	},
	{
		displayName: 'Quality',
		name: 'quality',
		type: 'options',
		options: [
			{ name: 'High', value: 'high', description: 'Largest file, best fidelity' },
			{ name: 'Balanced', value: 'balanced', description: 'Sensible default' },
			{ name: 'Small', value: 'small', description: 'Smallest file, softest image' },
		],
		default: 'balanced',
		description: 'Encoder quality preset',
		routing: {
			send: {
				type: 'body',
				property: 'quality',
			},
		},
	},
];
