# Resource Module（资源管理模块）

## 模块名称 (Module Name)

Resource（资源管理模块）

## 概述 (Overview)

Resource 模块提供前端资源上传、头像裁剪、资源类型定义，以及统一的图片/资源路径解析能力。图片路径统一通过 `services/resource-url.service.ts` 处理，后续可集中接入 `PUBLIC_RESOURCE_BASE_URL` 或 `PUBLIC_API_BASE_URL`。

## 文件清单 (File List)

`resource.module.ts` — 导出资源上传 hook、头像裁剪组件、图片/资源路径解析函数。

`components/SquareAvatarCropModal.vue` — 方形头像裁剪组件，支持选图、拖拽、缩放、旋转、预览与确认导出。

`components/ImageViewer.vue` — 通用图片预览/灯箱组件; Teleport 到 body 避免被祖先 transform/filter 等创建的 containing block 影响 fixed 定位; 支持滚轮缩放、拖拽移动、双击 reset、90° 旋转、下载、ESC 关闭、键盘 +/-/0/R 快捷键。

`hooks/useResourceUpload.ts` — 统一资源上传 hook，支持单文件、多文件、分片上传与取消上传。

`services/resource-url.service.ts` — 统一解析前端图片路径和资源路径，集中处理 base URL。

`types/resource.types.ts` — 资源上传响应、资源列表项与查询 schema 类型。

## 函数清单 (Function List)

`useResourceUpload()` — 创建资源上传状态与操作集合 | keywords: resource-upload-hook, drag-drop, multi-file, chunked, resume

`upload(file, opts?)` — 上传单个文件并维护上传进度 | keywords: single-upload, resource-upload, upload-progress

`uploadMultiple(files, opts?)` — 上传多个文件并维护上传队列状态 | keywords: multi-upload, resource-upload, upload-queue

`abort(itemId?)` — 取消指定上传项 | keywords: abort-upload, resource-upload, upload-cancel

`abortAll()` — 取消所有上传项 | keywords: abort-all-uploads, resource-upload, upload-cancel

`resolveImageUrl(path?, options?)` — 解析头像、markdown 图片等前端图片可渲染地址 | keywords: image-url, resource-url, base-url

`resolveResourceUrl(path?, options?)` — 解析文件下载、上传结果等资源访问地址 | keywords: resource-url, image-url, base-url

`SquareAvatarCropModal.confirm()` — 确认头像裁剪结果并向调用方返回文件 | keywords: square-crop, avatar-crop, drag, zoom, preview

`ImageViewer({open, src, alt})` — 全屏图片查看; Teleport 到 body 防祖先 transform 锚定 fixed 失效; 滚轮缩放/拖拽/旋转/下载/ESC 关闭 | keywords: image-viewer, lightbox, teleport, zoom, pan, rotate, escape-key

## 关键词索引 (Keyword Index)

| 中文关键词 | English Keywords |
|---|---|
| 图片路径 | image-url |
| 资源地址 | resource-url |
| 基础地址 | base-url |
| 资源上传 | resource-upload |
| 单文件上传 | single-upload |
| 多文件上传 | multi-upload |
| 上传进度 | upload-progress |
| 上传队列 | upload-queue |
| 取消上传 | abort-upload |
| 上传中止 | upload-cancel |
| 上传响应 | upload-response |
| 资源校验 | resource-schema |
| 访问路径 | access-path |
| 资源列表 | resource-list |
| 查询参数 | query-schema |
| 会话文件 | session-files |
| 方形裁剪 | square-crop |
| 头像裁剪 | avatar-crop |

## 类型导出 (Type Exports)

`ResolveResourceUrlOptions` — 图片/资源路径解析的可选配置，当前支持 `baseUrl` 覆盖。

`UploadResourceResponse` — `/resources/upload` 返回的资源上传结果。

`ResourceListItem` — `/resources` 列表返回的资源条目。

`UploadResourceResponseSchema` — 校验资源上传响应结构。

`ResourceListQuerySchema` — 校验资源列表查询条件。

## 模块功能描述 (Module Function Description)

资源上传相关界面通过 `useResourceUpload` 上传文件并获取后端返回的资源路径。任何头像、markdown 图片、用户图片预览、资源链接展示，都应通过 `resolveImageUrl` 或 `resolveResourceUrl` 统一补齐访问地址，避免组件内自行拼接 `/api`、静态路径或未来资源 base URL。
