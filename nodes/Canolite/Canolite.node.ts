import {
	NodeConnectionTypes,
	NodeOperationError,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { renderProperties } from './resources/render';
import { extractTemplateId, getTemplateFieldSchema, searchTemplates } from './shared/template';

export class Canolite implements INodeType {
	methods = {
		listSearch: {
			// Powers the Template picker's "From List" mode.
			searchTemplates,
		},

		resourceMapping: {
			// Turns the chosen template's objects into the Fields form.
			getTemplateFieldSchema,
		},

		loadOptions: {
			/**
			 * Object dropdown for the Batch operation's Modifications list, which
			 * cannot use the resource mapper — a mapper describes one set of values,
			 * and a batch needs one per output.
			 *
			 * The type is encoded into the value ("dealer_name|text") so the
			 * modification form shows only the relevant input: Text vs Image URL vs
			 * Video URL. The trailing "|type" is stripped again before the request is
			 * sent.
			 */
			async getTemplateFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const templateId = extractTemplateId(this.getNodeParameter('templateId', ''));
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
		// 2 is a clean break from 1.x: the panel is now Resource → Operation →
		// Template → Fields, and the old parameter names are gone. Workflows built
		// on 1.x need their Canolite nodes set up again.
		version: 2,
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
		properties: renderProperties,
	};
}
