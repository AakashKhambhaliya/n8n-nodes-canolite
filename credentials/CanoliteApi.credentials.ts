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
			description:
				'The root URL of your Canolite instance, the same address you open in the browser — without /api or /v1',
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
			description: 'An API key from Canolite → API Keys (starts with sk_live_)',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				// Trimmed: a key pasted with a trailing space or newline is a 401.
				Authorization: '=Bearer {{ String($credentials?.apiKey ?? "").trim() }}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ String($credentials?.baseUrl ?? "").replace(/\\/+$/, "") }}',
			url: '/v1/templates',
			method: 'GET',
		},
	};
}
