import type { INodeProperties } from 'n8n-workflow';
import { imageGenerateDescription } from './generate';
import { imageGenerateSyncDescription } from './generateSync';
import { imageBatchGenerateDescription } from './batchGenerate';
import { imageGetStatusDescription } from './getStatus';
import { pollForRenderCompletion } from '../../shared/pollRender';

const showOnlyForImage = {
	resource: ['image'],
};

export const imageDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForImage,
		},
		options: [
			{
				name: 'Generate',
				value: 'generate',
				action: 'Generate an image',
				description: 'Generate a single image asynchronously',
				routing: {
					request: {
						method: 'POST',
						url: '=/v1/images',
					},
					output: {
						postReceive: [pollForRenderCompletion('image')],
					},
				},
			},
			{
				name: 'Generate (Synchronous)',
				value: 'generateSync',
				action: 'Generate an image synchronously',
				description: 'Generate a single image and wait for the result',
				routing: {
					request: {
						method: 'POST',
						url: '=/v1/images',
					},
				},
			},
			{
				name: 'Batch Generate',
				value: 'batchGenerate',
				action: 'Batch generate images',
				description: 'Generate multiple images from a template in one request',
				routing: {
					request: {
						method: 'POST',
						url: '=/v1/images/batch',
					},
				},
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				action: 'Get render status',
				description: 'Get the status of a render job',
				routing: {
					request: {
						method: 'GET',
						url: '=/v1/images/{{$parameter.renderUid}}',
					},
				},
			},
		],
		default: 'generate',
	},
	...imageGenerateDescription,
	...imageGenerateSyncDescription,
	...imageBatchGenerateDescription,
	...imageGetStatusDescription,
];
