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
  { value: 'kimi', label: 'Kimi' },
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
  kimi: [
    'kimi-k2.6',
    'kimi-k2.5',
    'kimi-k2-thinking',
    'kimi-k2-thinking-turbo',
    'moonshot-v1-8k',
    'moonshot-v1-32k',
    'moonshot-v1-128k',
  ],
  // NVIDIA NIM (build.nvidia.com) :: OpenAI 兼容协议, thinking 走 chat_template_kwargs.enable_thinking
  //  - reasoning 模型 (qwen3 / qwq / deepseek-r1) 默认带 thinking, 通过开关可关
  //  - 普通 chat 模型 thinking 字段被服务端忽略, 不影响行为
  //  - 完整目录见 https://build.nvidia.com/explore/discover, 这里只列常用 SKU
  nvidia: [
    // Qwen 系列 (reasoning)
    'qwen/qwen3-235b-a22b',
    'qwen/qwen3-32b',
    'qwen/qwq-32b',
    // Qwen 系列 (chat)
    'qwen/qwen2.5-72b-instruct',
    'qwen/qwen2.5-coder-32b-instruct',
    // DeepSeek
    'deepseek-ai/deepseek-r1',
    'deepseek-ai/deepseek-r1-distill-llama-70b',
    'deepseek-ai/deepseek-r1-distill-qwen-32b',
    'deepseek-ai/deepseek-v3',
    // Llama / Nemotron
    'meta/llama-3.3-70b-instruct',
    'meta/llama-3.1-405b-instruct',
    'meta/llama-3.1-70b-instruct',
    'meta/llama-3.1-8b-instruct',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'nvidia/llama-3.1-nemotron-51b-instruct',
    'nvidia/llama-3.3-nemotron-super-49b-v1',
    // Mistral
    'mistralai/mistral-large-2-instruct',
    'mistralai/mixtral-8x22b-instruct-v0.1',
    // Google
    'google/gemma-3-27b-it',
    'google/gemma-2-27b-it',
  ],
  azure_openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-35-turbo'],
};

export const PROVIDER_DEFAULT_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  kimi: 'https://api.moonshot.cn/v1',
  nvidia: 'https://integrate.api.nvidia.com/v1',
};
