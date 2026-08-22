import {
	NodeConnectionTypes,
	NodeOperationError,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { imageDescription } from './resources/image';
import { templateDescription } from './resources/template';
import { videoDescription } from './resources/video';

export class Canolite implements INodeType {
	methods = {
		loadOptions: {
			/**
			 * Fetches the modifiable objects for the currently entered Template ID
			 * and exposes them as dropdown options for the modification "Name" field.
			 * Reloads whenever the Template ID changes (see loadOptionsDependsOn).
			 */
			async getTemplateFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const templateId = (this.getNodeParameter('templateId', '') as string)?.trim();
				if (!templateId) {
					return [];
				}

				const credentials = await this.getCredentials('canoliteApi');
				const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');

				let response;
				try {
					response = (await this.helpers.httpRequestWithAuthentication.call(this, 'canoliteApi', {
						method: 'GET',
						url: `${baseUrl}/v1/templates/${encodeURIComponent(templateId)}`,
						json: true,
					})) as { fields?: Array<{ name: string; type?: string }> };
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Could not load objects for template "${templateId}": ${(error as Error).message}`,
						{ description: 'Check that the Template ID and your Canolite credentials are correct.' },
					);
				}

				const fields = Array.isArray(response?.fields) ? response.fields : [];
				return fields
					.filter((field) => field?.name)
					.map((field) => ({
						// The type is encoded into the value (e.g. "dealer_name|text") so the
						// modification form can show only the relevant input (Text vs Image URL).
						// The trailing "|type" is stripped again before the request is sent.
						name: field.type ? `${field.name} (${field.type})` : field.name,
						value: field.type ? `${field.name}|${field.type}` : field.name,
					}));
			},
		},
	};

	description: INodeTypeDescription = {
		displayName: 'Canolite',
		name: 'canolite',
		icon: { light: 'file:../../icons/canolite.svg', dark: 'file:../../icons/canolite.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Generate images and videos from templates using the Canolite API',
		defaults: {
			name: 'Canolite',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'canoliteApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials?.baseUrl}}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Image',
						value: 'image',
					},
					{
						name: 'Template',
						value: 'template',
					},
					{
						name: 'Video',
						value: 'video',
					},
				],
				default: 'image',
			},
			...imageDescription,
			...templateDescription,
			...videoDescription,
		],
	};
}
