import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CanoliteApi implements ICredentialType {
	name = 'canoliteApi';

	displayName = 'Canolite API';

	icon: Icon = { light: 'file:../icons/canolite.svg', dark: 'file:../icons/canolite.dark.svg' };

	documentationUrl = 'https://github.com/AakashKhambhaliya/canolite#api-reference';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://localhost:3000',
			placeholder: 'e.g. https://canolite.example.com',
			description: 'The base URL of your Canolite instance',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			placeholder: 'e.g. sk_live_abc123',
			description: 'Your Canolite API key',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials?.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials?.baseUrl}}',
			url: '/v1/templates',
			method: 'GET',
		},
	};
}
