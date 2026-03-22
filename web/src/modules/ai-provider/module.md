# AI Provider Module（AI 模型提供商模块）

## 功能描述

AI Provider module provides UI and hooks for managing AI model configurations.

## 目录结构

```
src/modules/ai-provider/
├── components/
│   └── AiProviderManagement.vue   # AI 商户管理组件
├── constants/
│   └── ai-provider.constants.ts   # 常量定义
├── description/
│   └── module.tip.ts              # 模块提示（开发用）
├── hooks/
│   └── useAiProviders.ts         # AI 商户 Hook
├── pages/
│   └── AiProviderPage.vue        # AI 商户页面
├── types/
│   └── ai-provider.types.ts      # 类型定义
└── ai-provider.module.ts          # 模块定义
```

## 核心文件与函数

### hooks/useAiProviders.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `list` | 获取 AI 商户列表 |
| `create` | 创建 AI 商户 |
| `update` | 更新 AI 商户 |
| `remove` | 删除 AI 商户 |
| `testConnection` | 测试连接 |

### components/AiProviderManagement.vue

主要区域：
- `provider-form` - 商户配置表单
- `model-list` - 模型列表
- `connection-test` - 连接测试

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `useAiProviders_list` | `web_ai_provider_hook_list_001` |
| `useAiProviders_create` | `web_ai_provider_hook_create_002` |
| `useAiProviders_update` | `web_ai_provider_hook_update_003` |
| `useAiProviders_remove` | `web_ai_provider_hook_remove_004` |
| `useAiProviders_testConnection` | `web_ai_provider_hook_test_005` |
| `AiProviderManagement_submit` | `web_ai_provider_ui_submit_006` |
