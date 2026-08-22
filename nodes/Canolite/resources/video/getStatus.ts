import type { INodeProperties } from 'n8n-workflow';

const showOnlyForVideoGetStatus = {
	operation: ['getStatus'],
	resource: ['video'],
};

export const videoGetStatusDescription: INodeProperties[] = [
	{
		displayName: 'Render UID',
		name: 'renderUid',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. vid_abc123',
		displayOptions: {
			show: showOnlyForVideoGetStatus,
		},
		description:
			'UID of the video render job to check, as returned by Generate. Video UIDs start with "vid_"; an image UID is not served here.',
	},
];
