import type { INodeProperties } from 'n8n-workflow';

const showOnlyForGetStatus = {
	operation: ['getStatus'],
	resource: ['image'],
};

export const imageGetStatusDescription: INodeProperties[] = [
	{
		displayName: 'Render UID',
		name: 'renderUid',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. render_abc123',
		displayOptions: {
			show: showOnlyForGetStatus,
		},
		description: 'UID of the render job to check',
	},
];
