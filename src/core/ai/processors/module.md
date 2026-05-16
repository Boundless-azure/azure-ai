# Chat Model Processors 模块

把 LangChain `on_chat_model_*` 事件载荷转换成 `ModelSseEvent` 迭代器,
按 provider 拆分, 主流程 (`ai-model.service.ts` 的 `chatStream`) 不感知字段差异.

## 文件列表

- `types.ts` — ChatModelProcessor 接口 + ChunkContext 上下文类型
  - keywords: processor-interface, chunk-context
- `utils.ts` — 共享字段提取工具 (extractReasoning / extractRawDelta / yieldContentText)
  - keywords: field-extract, raw-response, content-text
- `default.processor.ts` — 标准 LangChain 字段映射, 覆盖 OpenAI/Azure/Anthropic/Gemini/Google/Custom
  - keywords: default-processor, standard-mapping, baseline
- `reasoning.processor.ts` — reasoning_content 严格按 reasoning yield, 覆盖 DeepSeek-R1 / NVIDIA NIM
  - keywords: reasoning-processor, thinking-separated, deepseek-r1, nim
- `index.ts` — selectProcessor(config) 注册表, 未注册 provider 走 default
  - keywords: processor-registry, select-processor, default-fallback

## 字段映射策略对照

| Processor | reasoning_content 字段 | 标准 content 字段 |
|---|---|---|
| default | additional_kwargs.reasoning_content / thoughts / thinking 等 → reasoning | chunk.content 字符串/数组 text block → token |
| reasoning | __raw_response.delta.reasoning_content → reasoning | chunk.content → token |

## 新增 provider 的工作流

| 情况 | 操作 |
|---|---|
| 标准 LangChain 字段就 work | 啥也不动, 自动走 default |
| reasoning 模型 (R1 风格) | 在 `index.ts` 的 `PROVIDER_PROCESSORS` 注册到 reasoningProcessor |
| 全新字段语义 | 新建 `xxx.processor.ts` + 注册 |
| 全新构造逻辑 | 上面 + 改 `ai-model.service.ts` 的 `createModelInstance` switch |

## 设计约束

- Processor 只处理 `on_chat_model_stream` chunk, **不处理 `on_chat_model_end`**
  - 流式 chunks 已完整传递所有 token / reasoning, model_end 的聚合 output 只是视图
  - 处理 model_end 会与 stream 重复 yield, 导致用户看到整段回复重复两次
- 不持有跨 chunk 状态 (runIdToToolId 等留在主流程)
- 不处理 `on_tool_*` 事件 (LangGraph 统一驱动, 无 provider 差异)
- 不依赖 NestJS DI (纯函数式生成器), 便于单测和复用
