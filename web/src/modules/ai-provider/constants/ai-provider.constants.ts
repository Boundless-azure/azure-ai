/**
 * @title AI提供商常量
 * @description AI提供商、接口规范与模型列表常量定义。
 * @keywords-cn AI提供商, 模型列表, 常量
 * @keywords-en ai-provider, model-catalog, constants
 */
export const AI_PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'nvidia', label: 'NVIDIA' },
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'custom', label: '自定义' },
];

export const AI_PROTOCOL_OPTIONS = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'anthropic', label: 'Anthropic' },
];

export const AI_MODEL_TYPE_OPTIONS = [
  { value: 'chat', label: '对话' },
  { value: 'completion', label: '补全' },
  { value: 'embedding', label: 'Embedding' },
];

export const AI_MODEL_STATUS_OPTIONS = [
  { value: 'active', label: '可用' },
  { value: 'inactive', label: '停用' },
  { value: 'deprecated', label: '废弃' },
  { value: 'maintenance', label: '维护中' },
];

export const PROVIDER_MODEL_CATALOG: Record<string, string[]> = {
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-3.5-turbo',
  ],
  anthropic: [
    'claude-3-5-sonnet',
    'claude-3-5-haiku',
    'claude-3-opus',
    'claude-3-sonnet',
  ],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  nvidia: [
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'nvidia/llama-3.1-nemotron-51b-instruct',
  ],
  azure_openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-35-turbo'],
};
