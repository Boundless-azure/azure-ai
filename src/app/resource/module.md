模块名称：app/resource（统一资源上传与访问模块）

概述
- 提供统一资源上传接口：限制 500MB、计算文件 MD5 和 SHA256（支持大文件抽样计算）、重复文件视为"假上传"，仅新增记录并复用存储路径。
- 提供分片上传接口：支持大文件分片上传（2MB/片）、断点续传、查询缺失分片。
- 提供统一资源访问接口：按资源表 id 进行流式返回，支持 Range、ETag 与缓存头，尽可能接近 Nginx 静态文件能力。
- 提供批量复制接口：支持通过资源 ID 列表批量复制资源（粘贴功能）。

文件清单（File List）
- app/resource/entities/resource.entity.ts
- app/resource/types/resource.types.ts
- app/resource/services/resource.service.ts
- app/resource/controllers/resource.controller.ts
- app/resource/resource.module.ts

函数清单（Function Index）
- ResourceService
  - upload(file, uploaderId) - 简单上传，MD5去重+SHA256计算
  - initChunkedUpload() - 分片上传初始化
  - uploadChunk() - 上传单个分片
  - getChunkStatus() - 查询分片状态（断点续传）
  - commitChunkedUpload() - 完成分片上传，合并文件
  - abortChunkedUpload() - 取消分片上传
  - batchDuplicate() - 批量复制资源
  - getResourceFileOrThrow() - 获取资源文件路径
  - countMd5References() - 统计MD5引用计数（跨租户去重）
- ResourceController
  - POST /resources/upload - 简单上传
  - POST /resources/upload/multiple - 多文件上传
  - POST /resources/chunked/init - 分片上传初始化
  - POST /resources/chunked/upload - 上传分片
  - GET /resources/chunked/status/:uploadId - 查询分片状态
  - POST /resources/chunked/commit - 完成分片上传
  - DELETE /resources/chunked/abort/:uploadId - 取消分片上传
  - POST /resources/batch/copy - 批量复制（粘贴）
  - GET /resources/:id - 资源访问（流式+Range）

关键词索引（中文 / English Keyword Index）
资源表 -> app/resource/entities/resource.entity.ts
资源上传 -> app/resource/controllers/resource.controller.ts
资源访问 -> app/resource/controllers/resource.controller.ts
资源服务 -> app/resource/services/resource.service.ts
资源类型 -> app/resource/types/resource.types.ts
资源模块 -> app/resource/resource.module.ts
SHA256去重 -> app/resource/services/resource.service.ts
分片上传 -> app/resource/services/resource.service.ts
断点续传 -> app/resource/services/resource.service.ts

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
- ResourceController.upload -> res_ctl_upload_009
- ResourceController.uploadMultiple -> res_ctl_upload_multiple_010
- ResourceController.initChunkedUpload -> res_ctl_chunk_init_011
- ResourceController.uploadChunk -> res_ctl_chunk_upload_012
- ResourceController.getChunkStatus -> res_ctl_chunk_status_013
- ResourceController.commitChunkedUpload -> res_ctl_chunk_commit_014
- ResourceController.batchDuplicate -> res_ctl_batch_copy_015
- ResourceController.get -> res_ctl_get_016

模块功能描述（Description）
本模块统一了文件资源的上传、去重与访问：
- 上传阶段对文件计算 MD5 和 SHA256（>=100MB 文件采用抽样算法：前1M+后1M+区间抽样），按 MD5+SHA256 归档存储，重复内容不会重复落盘。
- 分片上传支持大文件（最大500MB），每片2MB，支持断点续传。
- 访问阶段按资源 ID 进行流式返回，支持 Range 与缓存相关响应头，方便前端以 <img>/<video> 直接引用并获得良好的性能表现。
- 批量复制接口支持跨租户粘贴资源。
