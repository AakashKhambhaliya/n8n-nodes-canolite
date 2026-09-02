import type { INodeProperties } from 'n8n-workflow';

/**
 * Optional styling overrides for a modification. These live inside a collapsible
 * collection so the common case — swapping text or an image — stays clean. Only
 * the overrides a user explicitly adds are sent to the Canolite API.
 */
const stylingOverrideFields: INodeProperties[] = [
	{
		displayName: 'Font Family',
		name: 'fontFamily',
		type: 'string',
		default: '',
		placeholder: 'e.g. Roboto',
		description: 'Override font family for text objects',
	},
	{
		displayName: 'Font Size',
		name: 'fontSize',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 1, maxValue: 1000 },
		description: 'Override font size for text objects (1-1000)',
	},
	{
		displayName: 'Font Weight',
		name: 'fontWeight',
		type: 'string',
		default: '',
		placeholder: 'e.g. bold',
		description: 'Override font weight',
	},
	{
		displayName: 'Font Style',
		name: 'fontStyle',
		type: 'string',
		default: '',
		placeholder: 'e.g. italic',
		description: 'Override font style',
	},
	{
		displayName: 'Fill Color',
		name: 'fill',
		type: 'color',
		default: '',
		description: 'Override fill color for text objects',
	},
	{
		displayName: 'Text Align',
		name: 'textAlign',
		type: 'options',
		options: [
			{ name: 'Left', value: 'left' },
			{ name: 'Center', value: 'center' },
			{ name: 'Right', value: 'right' },
			{ name: 'Justify', value: 'justify' },
		],
		default: 'left',
		description: 'Override text alignment',
	},
	{
		displayName: 'Line Height',
		name: 'lineHeight',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0.1, maxValue: 10 },
		description: 'Override line height (0.1-10)',
	},
	{
		displayName: 'Height',
		name: 'height',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 1 },
		description: 'Override object height',
	},
	{
		displayName: 'Char Spacing',
		name: 'charSpacing',
		type: 'number',
		default: 0,
		description: 'Override character spacing',
	},
	{
		displayName: 'Underline',
		name: 'underline',
		type: 'boolean',
		default: false,
		description: 'Whether to set underline on the text object',
	},
	{
		displayName: 'Opacity',
		name: 'opacity',
		type: 'number',
		default: 1,
		typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
		description: 'Override opacity (0-1)',
	},
	{
		displayName: 'Background Color',
		name: 'backgroundColor',
		type: 'color',
		default: '',
		description: 'Override background color',
	},
];

/**
 * Playback overrides for a video layer. Collected rather than listed flat so
 * that only what the user explicitly adds is sent — the API treats an absent
 * key as "keep the template's value", and sending defaults for all of these
 * would silently override whatever was set in the editor.
 */
const videoOverrideFields: INodeProperties[] = [
	{
		displayName: 'Trim Start',
		name: 'trim_start',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, numberPrecision: 2 },
		description: 'Seconds into the source clip where playback begins',
	},
	{
		displayName: 'Trim End',
		name: 'trim_end',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, numberPrecision: 2 },
		description: 'Seconds into the source clip where playback stops',
	},
	{
		displayName: 'Start At',
		name: 'start_at',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, numberPrecision: 2 },
		description: 'Seconds into the output video before this layer appears',
	},
	{
		displayName: 'Volume',
		name: 'volume',
		type: 'number',
		default: 1,
		typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 2 },
		description: 'Audio volume, where 1 is the original level and 2 is doubled',
	},
	{
		displayName: 'Muted',
		name: 'muted',
		type: 'boolean',
		default: false,
		description: 'Whether to drop this layer\'s audio from the output',
	},
	{
		displayName: 'Loop',
		name: 'loop',
		type: 'boolean',
		default: true,
		description: 'Whether to repeat the clip if the output is longer than it is',
	},
];

/**
 * Shared modification fields used in both single and batch generation.
 * The default view stays minimal — pick the template object (Name) and provide
 * the replacement Text, Image URL or Video URL. Everything else is optional.
 */
export const modificationFields: INodeProperties[] = [
	{
		displayName: 'Name or ID',
		name: 'name',
		type: 'options',
		required: true,
		default: '',
		typeOptions: {
			loadOptionsMethod: 'getTemplateFields',
			loadOptionsDependsOn: ['templateId.value'],
		},
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		hint: 'The object in the template to modify. Enter the Template ID first to populate this list.',
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 2 },
		default: '',
		description: 'Replacement text (for text objects)',
		// Shown for text objects and for manually/expression-entered names; hidden
		// when an image, video or shape object is selected from the list. Video
		// belongs in that list too — without it, picking a video layer offered a
		// Text box that the API has nothing to do with.
		displayOptions: {
			hide: {
				name: [
					{ _cnd: { endsWith: '|image' } },
					{ _cnd: { endsWith: '|video' } },
					{ _cnd: { endsWith: '|shape' } },
				],
			},
		},
	},
	{
		displayName: 'Image URL',
		name: 'image_url',
		type: 'string',
		default: '',
		placeholder: 'e.g. https://example.com/image.png',
		description: 'URL of the replacement image (for image objects, must be public http/https)',
		// Shown only when an image object is selected from the list.
		displayOptions: {
			show: {
				name: [{ _cnd: { endsWith: '|image' } }],
			},
		},
	},
	{
		displayName: 'Video URL',
		name: 'video_url',
		type: 'string',
		default: '',
		placeholder: 'e.g. https://example.com/clip.mp4',
		description:
			'URL of the replacement clip (for video objects, must be public http/https). Leave empty to keep the template\'s own clip and only change the playback settings below.',
		displayOptions: {
			show: {
				name: [{ _cnd: { endsWith: '|video' } }],
			},
		},
	},
	{
		displayName: 'Video Settings',
		name: 'video',
		type: 'collection',
		placeholder: 'Add Video Setting',
		default: {},
		description: 'Optional trim, timing and audio overrides for this video layer',
		options: videoOverrideFields,
		displayOptions: {
			show: {
				name: [{ _cnd: { endsWith: '|video' } }],
			},
		},
	},
	{
		displayName: 'Styling Overrides',
		name: 'styling',
		type: 'collection',
		placeholder: 'Add Styling Override',
		default: {},
		description: 'Optional font, color and layout overrides — not needed for a normal text or image swap',
		options: stylingOverrideFields,
	},
];

/**
 * Builds the modifications array sent to the Canolite API from a list of
 * modification entries, including only the properties the user actually set.
 * Shared as an expression by the single and batch generate operations.
 */
export const buildModificationsExpression = `(mods) => (mods || []).map((m) => { const raw = String(m.name || ''); const parts = raw.split('|'); const suffix = parts[parts.length - 1]; const name = (parts.length > 1 && (suffix === 'text' || suffix === 'image' || suffix === 'video' || suffix === 'shape')) ? parts.slice(0, -1).join('|') : raw; const clean = { name: name }; if (m.text) clean.text = m.text; if (m.image_url) clean.image_url = m.image_url; if (m.video_url) clean.video_url = m.video_url; const v = m.video || {}; if (v.trim_start !== undefined) clean.trim_start = v.trim_start; if (v.trim_end !== undefined) clean.trim_end = v.trim_end; if (v.start_at !== undefined) clean.start_at = v.start_at; if (v.volume !== undefined) clean.volume = v.volume; if (v.muted !== undefined) clean.muted = v.muted; if (v.loop !== undefined) clean.loop = v.loop; const s = m.styling || {}; if (s.fontFamily) clean.fontFamily = s.fontFamily; if (s.fontSize > 0) clean.fontSize = s.fontSize; if (s.fontWeight) clean.fontWeight = s.fontWeight; if (s.fontStyle) clean.fontStyle = s.fontStyle; if (s.fill) clean.fill = s.fill; if (s.textAlign) clean.textAlign = s.textAlign; if (s.lineHeight > 0) clean.lineHeight = s.lineHeight; if (s.height > 0) clean.height = s.height; if (s.charSpacing) clean.charSpacing = s.charSpacing; if (s.underline === true) clean.underline = s.underline; if (s.opacity !== undefined && s.opacity !== 1) clean.opacity = s.opacity; if (s.backgroundColor) clean.backgroundColor = s.backgroundColor; return clean; })`;

/**
 * The modifications fixedCollection definition (reusable in single & batch).
 */
export const modificationsCollection: INodeProperties = {
	displayName: 'Modifications',
	name: 'modifications',
	type: 'fixedCollection',
	typeOptions: {
		multipleValues: true,
		multipleValueButtonText: 'Add Modification',
	},
	placeholder: 'Add Modification',
	default: {},
	options: [
		{
			name: 'modification',
			displayName: 'Modification',
			values: modificationFields,
		},
	],
};
