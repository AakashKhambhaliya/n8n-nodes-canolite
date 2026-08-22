import type { INodeProperties } from 'n8n-workflow';
import { videoGenerateDescription } from './generate';
import { videoBatchGenerateDescription } from './batchGenerate';
import { videoGetStatusDescription } from './getStatus';
import { pollForRenderCompletion } from '../../shared/pollRender';

const showOnlyForVideo = {
	resource: ['video'],
};

/**
 * Video rendering (Canolite 1.8+).
 *
 * There is no synchronous counterpart here, unlike images: encoding is far too
 * slow to hold a request open, so every video render is queued and answered
 * with 202 plus a uid. Use "Wait for Completion" to have the node poll, or the
 * Get Status operation to poll yourself.
 */
export const videoDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForVideo,
		},
		options: [
			{
				name: 'Generate',
				value: 'generate',
				action: 'Generate a video',
				description: 'Render a single MP4 from a template that contains a video layer',
				routing: {
					request: {
						method: 'POST',
						url: '=/v1/videos',
					},
					output: {
						postReceive: [pollForRenderCompletion('video', 'videoOptions')],
					},
				},
			},
			{
				name: 'Batch Generate',
				value: 'batchGenerate',
				action: 'Batch generate videos',
				description: 'Render up to 20 videos from one template in a single request',
				routing: {
					request: {
						method: 'POST',
						url: '=/v1/videos/batch',
					},
				},
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				action: 'Get video render status',
				description: 'Get the status and progress of a video render job',
				routing: {
					request: {
						method: 'GET',
						url: '=/v1/videos/{{$parameter.renderUid}}',
					},
				},
			},
		],
		default: 'generate',
	},
	...videoGenerateDescription,
	...videoBatchGenerateDescription,
	...videoGetStatusDescription,
];
