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
  { value: 'minimax', label: 'MiniMax' },
  { value: 'nvidia', label: 'NVIDIA' },
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'custom', label: '自定义' },
];

export const AI_PROTOCOL_OPTIONS = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'anthropic', label: 'Anthropic' },
];

/**
 * MiniMax 国内/海外协议预设选项。
 * @keyword-cn MiniMax协议, 国内海外, 接口规范
 * @keyword-en minimax-protocol, regional-endpoint, api-spec
 */
export const MINIMAX_PROTOCOL_OPTIONS = [
  { value: 'minimax-anthropic-cn', label: 'Anthropic 兼容 · 国内' },
  { value: 'minimax-anthropic-global', label: 'Anthropic 兼容 · 海外' },
  { value: 'minimax-openai-cn', label: 'OpenAI 兼容 · 国内' },
  { value: 'minimax-openai-global', label: 'OpenAI 兼容 · 海外' },
];

/**
 * MiniMax UI 预设到后端真实协议和 BaseURL 的映射。
 * @keyword-cn MiniMax端点, BaseURL, 接口规范
 * @keyword-en minimax-endpoint, base-url, api-spec
 */
export const MINIMAX_ENDPOINT_PRESETS: Record<
  string,
  { apiProtocol: 'openai' | 'anthropic'; baseURL: string }
> = {
  'minimax-anthropic-cn': {
    apiProtocol: 'anthropic',
    baseURL: 'https://api.minimaxi.com/anthropic',
  },
  'minimax-anthropic-global': {
    apiProtocol: 'anthropic',
    baseURL: 'https://api.minimax.io/anthropic',
  },
  'minimax-openai-cn': {
    apiProtocol: 'openai',
    baseURL: 'https://api.minimaxi.com/v1',
  },
  'minimax-openai-global': {
    apiProtocol: 'openai',
    baseURL: 'https://api.minimax.io/v1',
  },
};

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

/**
 * Smart 历史分段"质量"档位 → smartSegmentChars 字符阈值映射。
 *  - 最优 (2000): 段小, LLM 摘要质量好但调用次数多 (贵), 适合上下文短/质量敏感的模型
 *  - 性价比 (5000): 默认档, 平衡质量与调用次数
 *  - 便宜 (10000): 段大, 调用次数少, 适合长上下文模型 (Claude / Gemini); 弱模型容易在长输入下"歇菜"
 * @keyword-cn 质量选择, smart分段阈值, 模型档位
 * @keyword-en smart-quality-options, segment-chars-tier
 */
export const SMART_SEGMENT_QUALITY_OPTIONS = [
  {
    value: 2000,
    label: '最优',
    hint: '2000 字/段',
    help: '段最短 → 单次只压缩少量轮次, 上下文保持最短 → 摘要最精准; 代价是压缩触发更频繁, 单位字数的 LLM 调用成本最高。适合上下文承载力弱 / 在长输入下容易降质的模型。',
  },
  {
    value: 5000,
    label: '性价比',
    hint: '5000 字/段',
    help: '中间档, 摘要质量与 LLM 调用次数平衡, 通用默认值; 多数模型在这个长度下都能稳定输出, 不挑模型。',
  },
  {
    value: 10000,
    label: '便宜',
    hint: '10000 字/段',
    help: '段最长 → 单次压缩较多轮次, 触发频率最低, 相同总字数下 LLM 调用次数最少, 单价最划算。**推荐配长上下文模型 (Claude / Gemini 2.5 等)**, 弱模型在 10k 输入下摘要质量会明显下降。',
  },
];

/** 未设置时的默认档位 (= 后端 SMART_SEGMENT_TARGET_CHARS_DEFAULT) @keyword-en smart-quality-default */
export const SMART_SEGMENT_QUALITY_DEFAULT = 5000;

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
  minimax: [
    'MiniMax-M2.7',
    'MiniMax-M2.7-highspeed',
    'MiniMax-M2.5',
    'MiniMax-M2.5-highspeed',
    'MiniMax-M2.1',
    'MiniMax-M2.1-highspeed',
    'MiniMax-M2',
    'MiniMax-Text-01',
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
  minimax: 'https://api.minimaxi.com/anthropic',
  nvidia: 'https://integrate.api.nvidia.com/v1',
};
