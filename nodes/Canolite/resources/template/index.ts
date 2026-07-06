import type { INodeProperties } from 'n8n-workflow';

const showOnlyForTemplate = {
	resource: ['template'],
};

export const templateDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForTemplate,
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a template',
				description: 'Retrieve a specific template',
				routing: {
					request: {
						method: 'GET',
						url: '=/v1/templates/{{$parameter.templateId}}',
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get all templates',
				description: 'Retrieve all templates',
				routing: {
					request: {
						method: 'GET',
						url: '/v1/templates',
					},
				},
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. tmpl_abc123',
		displayOptions: {
			show: {
				operation: ['get'],
				resource: ['template'],
			},
		},
		description: 'ID of the template to retrieve',
	},
];
