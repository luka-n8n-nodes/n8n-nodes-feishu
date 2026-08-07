import { INodeProperties } from 'n8n-workflow';

export function parseBitableAutoMapExcludeFields(value: unknown): string[] {
	if (value === undefined || value === null || value === '') {
		return [];
	}

	if (Array.isArray(value)) {
		return value.map((item) => String(item).trim()).filter(Boolean);
	}

	if (typeof value === 'string') {
		return value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	const normalized = String(value).trim();
	return normalized ? [normalized] : [];
}

export function createBitableAutoMapExcludeFieldsProperty(
	fieldValuesParameterName: string,
): INodeProperties {
	return {
		displayName: '排除字段',
		name: 'excludeFields',
		type: 'string',
		default: '',
		placeholder: 'e.g. field1,field2',
		description:
			'自动映射时要排除的输入字段。支持英文逗号分隔的字符串，或通过表达式传入字符串数组。',
		displayOptions: {
			show: {
				[`/${fieldValuesParameterName}.mappingMode`]: ['autoMapInputData'],
			},
		},
	};
}
