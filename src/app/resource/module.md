模块名称：app/resource（统一资源上传与访问模块）

概述
- 提供统一资源上传接口：限制 500MB、计算文件 MD5 和 SHA256（支持大文件抽样计算）、重复文件视为"假上传"，仅新增记录并复用存储路径。
- 提供分片上传接口：支持大文件分片上传（2MB/片）、断点续传、查询缺失分片。
- 提供统一资源访问接口：按资源表 id 进行流式返回，支持 Range、ETag 与缓存头，尽可能接近 Nginx 静态文件能力。
- 提供批量复制接口：支持通过资源 ID 列表批量复制资源（粘贴功能）。
- 支持资源与聊天会话可选关联：resources.session_id 为空表示全局资源，非空可用于对话窗口文件列表。

文件清单（File List）
- app/resource/entities/resource.entity.ts
- app/resource/types/resource.types.ts
- app/resource/services/resource.service.ts
- app/resource/services/resource-sign.service.ts
- app/resource/controllers/resource.controller.ts
- app/resource/resource.module.ts

函数清单（Function Index）
- ResourceService
  - getResourceById(id) - 按 ID 查资源元信息, 不验物理文件; createNode 等 hook 用它做存在性 + 跨租户校验 | keywords: get-resource-by-id, exists-check
  - listPaged({sessionId,category,q,limit,offset}) - 分页查询, 返回 {items,total,hasMore,limit,offset}; 给 saas.app.resource.currentSession 用 | keywords: list-resources-paged, current-session-resources
  - upload(file, uploaderId, sessionId?, tenantId?) - 简单上传，MD5去重+SHA256计算; 写入 channelId=tenantId, 返回 path 已带 sig+tid 签名 | keywords: simple-upload, tenant-isolation, signed-path
  - initChunkedUpload(filename, totalChunks, fileSize, md5, mimeType, uploaderId, sessionId?, tenantId?) - 分片上传初始化, 同样写入 channelId | keywords: chunk-init, tenant-isolation
  - uploadChunk() - 上传单个分片
  - getChunkStatus() - 查询分片状态（断点续传）
  - commitChunkedUpload() - 完成分片上传，合并文件; 返回 path 用 entity.channelId 算签名 | keywords: chunk-commit, signed-path
  - abortChunkedUpload() - 取消分片上传
  - batchDuplicate(ids, uploaderId, tenantId?) - 批量复制资源, 新副本写入调用方 tenantId
  - list(query) - 查询 resources 表，可按 sessionId/category/q 过滤; 返回 path 已带签名
  - getResourceFileOrThrow() - 获取资源文件路径
  - countMd5References() - 统计MD5引用计数（跨租户去重）
- ResourceSignService (新增)
  - buildAccessPath(id, tenantId) - 构造 /resources/:id?sig=...&tid=... 完整签名 path | keywords: build-signed-path, signed-url
  - verify(id, tenantId, sig) - 时间安全 HMAC 校验, 用于 GET 拦截非法访问 | keywords: verify-resource-sig, timing-safe
- ResourceController (含 @HookController(plugin=resource, tags=[resource, file]))
  - POST /resources/upload - 简单上传
  - POST /resources/upload/multiple - 多文件上传
  - POST /resources/chunked/init - 分片上传初始化
  - POST /resources/chunked/upload - 上传分片
  - GET /resources/chunked/status/:uploadId - 查询分片状态
  - POST /resources/chunked/commit - 完成分片上传
  - DELETE /resources/chunked/abort/:uploadId - 取消分片上传
  - **hook saas.app.resource.currentSession** - 列出当前聊天会话已上传的资源 (分页); sessionId 由 ctx.extras.sessionId 强制注入, LLM 不能跨会话查; 返回 items[].resourceId 可直接传给 saas.app.storage.createNode | keywords: current-session-resources, paged-list, ctx-driven-session, resource-id-for-llm
- POST /resources/batch/copy - 批量复制（粘贴）
- GET /resources?sessionId=xxx - 查询资源列表（聊天文件列表使用 resources 表）
- GET /resources/:id?sig=&tid= - 资源访问（流式+Range）; @Public 兼容 <img> 直链, 但强制要求 sig+tid 签名 (历史无 channelId 资源兼容期免签); 白名单 mime (image非svg / video / audio / pdf) 走 inline, 其它一律 application/octet-stream + attachment; 全局 X-Content-Type-Options: nosniff 阻止 MIME sniff XSS | keywords: signed-access, tenant-isolation, force-download, nosniff

关键词索引（中文 / English Keyword Index）
资源表 -> app/resource/entities/resource.entity.ts
资源上传 -> app/resource/controllers/resource.controller.ts
资源访问 -> app/resource/controllers/resource.controller.ts
资源服务 -> app/resource/services/resource.service.ts
资源类型 -> app/resource/types/resource.types.ts
资源模块 -> app/resource/resource.module.ts
资源签名 -> app/resource/services/resource-sign.service.ts
租户隔离 -> app/resource/services/resource-sign.service.ts
强制下载 -> app/resource/controllers/resource.controller.ts
SHA256去重 -> app/resource/services/resource.service.ts
分片上传 -> app/resource/services/resource.service.ts
断点续传 -> app/resource/services/resource.service.ts

| 中文关键词 | English Keywords |
|---|---|
| 资源签名 | resource-sign, signed-url |
| 租户隔离 | tenant-isolation |
| 越权防护 | anti-enum |
| 强制下载 | force-download, attachment |
| MIME 嗅探防御 | nosniff |
| 时间安全 | timing-safe |

快速检索映射（Keywords -> Files）
- "ResourceEntity" -> app/resource/entities/resource.entity.ts
- "ResourceService" -> app/resource/services/resource.service.ts
- "ResourceController" -> app/resource/controllers/resource.controller.ts
- "ResourceModule" -> app/resource/resource.module.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- ResourceService.upload -> res_upload_001
- ResourceService.initChunkedUpload -> res_chunk_init_002
- ResourceService.uploadChunk -> res_chunk_upload_003
- ResourceService.getChunkStatus -> res_chunk_status_004
- ResourceService.commitChunkedUpload -> res_chunk_commit_005
- ResourceService.batchDuplicate -> res_batch_copy_006
- ResourceService.countMd5References -> res_md5_ref_count_007
- ResourceService.getResourceFileOrThrow -> res_get_file_or_throw_008
- ResourceService.list -> res_list_017
- ResourceController.upload -> res_ctl_upload_009
- ResourceController.uploadMultiple -> res_ctl_upload_multiple_010
- ResourceController.initChunkedUpload -> res_ctl_chunk_init_011
- ResourceController.uploadChunk -> res_ctl_chunk_upload_012
- ResourceController.getChunkStatus -> res_ctl_chunk_status_013
- ResourceController.commitChunkedUpload -> res_ctl_chunk_commit_014
- ResourceController.batchDuplicate -> res_ctl_batch_copy_015
- ResourceController.get -> res_ctl_get_016
- ResourceController.list -> res_ctl_list_017

模块功能描述（Description）
本模块统一了文件资源的上传、去重与访问：
- 上传阶段对文件计算 MD5 和 SHA256（>=100MB 文件采用抽样算法：前1M+后1M+区间抽样），按 MD5+SHA256 归档存储，重复内容不会重复落盘。
- 分片上传支持大文件（最大500MB），每片2MB，支持断点续传。
- 访问阶段按资源 ID 进行流式返回，支持 Range 与缓存相关响应头，方便前端以 <img>/<video> 直接引用并获得良好的性能表现。
- 批量复制接口支持跨租户粘贴资源。
