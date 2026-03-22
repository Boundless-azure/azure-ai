# Resource Module（资源管理模块）

## 功能描述

Resource module provides unified upload hook with progress, chunked upload, resume support, drag-drop and multi-file upload for reuse across modules.

## 目录结构

```
src/modules/resource/
├── api/
│   └── resource.ts                # 资源 API
├── components/
│   └── SquareAvatarCropModal.vue  # 方形头像裁剪组件
├── description/
│   └── module.tip.ts              # 模块提示（开发用）
├── hooks/
│   └── useResourceUpload.ts       # 资源上传 Hook
├── types/
│   └── resource.types.ts          # 类型定义
└── resource.module.ts             # 模块定义
```

## 核心文件与函数

### hooks/useResourceUpload.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `upload` | 上传单个文件 |
| `uploadMultiple` | 上传多个文件 |
| `abort` | 取消上传 |

### api/resource.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `upload` | 基础上传 |
| `uploadMultiple` | 多文件上传 |
| `smartUpload` | 智能上传（自动选择方式） |
| `initChunkedUpload` | 初始化分片上传 |
| `uploadChunk` | 上传分片 |
| `getChunkStatus` | 获取分片状态 |
| `commitChunkedUpload` | 提交分片上传 |
| `batchCopy` | 批量复制 |

### components/SquareAvatarCropModal.vue

主要区域：
- `crop-area` - 裁剪区域
- `preview-area` - 预览区域

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `resourceApi_upload` | `web_res_api_upload_001` |
| `resourceApi_uploadMultiple` | `web_res_api_upload_multiple_002` |
| `resourceApi_smartUpload` | `web_res_api_smart_upload_003` |
| `resourceApi_initChunkedUpload` | `web_res_api_chunked_init_004` |
| `resourceApi_uploadChunk` | `web_res_api_chunk_upload_005` |
| `resourceApi_getChunkStatus` | `web_res_api_chunk_status_006` |
| `resourceApi_commitChunkedUpload` | `web_res_api_chunk_commit_007` |
| `resourceApi_batchCopy` | `web_res_api_batch_copy_008` |
| `useResourceUpload_upload` | `web_res_hook_upload_009` |
| `useResourceUpload_uploadMultiple` | `web_res_hook_upload_multiple_010` |
| `useResourceUpload_abort` | `web_res_hook_abort_011` |
| `SquareAvatarCropModal_confirm` | `web_res_cmp_avatar_crop_confirm_012` |
