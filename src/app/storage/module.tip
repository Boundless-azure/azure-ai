模块名称：app/storage（资源库存储模块）

概述
- 提供资源库目录结构管理：支持文件夹和文件节点创建、查询、更新、删除。
- 支持分享链接创建：临时分享、永久分享、密码分享。
- 支持删除时检查底层资源 MD5 引用计数（跨租户），确保物理文件仅在无引用时删除。

文件清单（File List）
- app/storage/entities/storage-node.entity.ts
- app/storage/types/storage.types.ts
- app/storage/services/storage.service.ts
- app/storage/controllers/storage.controller.ts
- app/storage/storage.module.ts

函数清单（Function Index）
- StorageService
  - createNode() - 创建存储节点（文件夹/文件）
  - getNode() - 获取节点详情
  - listNodes() - 获取子节点列表
  - getRootNodes() - 获取根目录节点
  - updateNode() - 更新节点（重命名、移动）
  - deleteNode() - 删除节点（软删除+MD5引用检查）
  - createShare() - 创建分享链接
  - getShareContent() - 获取分享内容
  - removeShare() - 删除分享链接
- StorageController
  - POST /storage/nodes - 创建节点
  - GET /storage/nodes - 获取节点列表
  - GET /storage/nodes/root - 获取根目录
  - GET /storage/nodes/:id - 获取节点详情
  - PUT /storage/nodes/:id - 更新节点
  - DELETE /storage/nodes/:id - 删除节点
  - POST /storage/nodes/:id/share - 创建分享
  - DELETE /storage/nodes/:id/share - 删除分享
  - GET /storage/share/:token - 访问分享内容

关键词索引（中文 / English Keyword Index）
存储节点 -> app/storage/entities/storage-node.entity.ts
资源库 -> app/storage/services/storage.service.ts
目录管理 -> app/storage/services/storage.service.ts
分享链接 -> app/storage/services/storage.service.ts
MD5引用检查 -> app/storage/services/storage.service.ts

快速检索映射（Keywords -> Files）
- "StorageNodeEntity" -> app/storage/entities/storage-node.entity.ts
- "StorageService" -> app/storage/services/storage.service.ts
- "StorageController" -> app/storage/controllers/storage.controller.ts
- "StorageModule" -> app/storage/storage.module.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- StorageService.createNode -> storage_create_node_001
- StorageService.getNode -> storage_get_node_002
- StorageService.listNodes -> storage_list_nodes_003
- StorageService.getRootNodes -> storage_root_nodes_004
- StorageService.updateNode -> storage_update_node_005
- StorageService.deleteNode -> storage_delete_node_006
- StorageService.createShare -> storage_create_share_007
- StorageService.getShareContent -> storage_get_share_008
- StorageService.removeShare -> storage_remove_share_009
- StorageController.createNode -> storage_ctl_create_010
- StorageController.listNodes -> storage_ctl_list_011
- StorageController.getRootNodes -> storage_ctl_root_012
- StorageController.getNode -> storage_ctl_get_013
- StorageController.updateNode -> storage_ctl_update_014
- StorageController.deleteNode -> storage_ctl_delete_015
- StorageController.createShare -> storage_ctl_create_share_016
- StorageController.removeShare -> storage_ctl_remove_share_017
- StorageController.getShareContent -> storage_ctl_get_share_018

模块功能描述（Description）
本模块提供资源库目录结构管理，支持文件夹和文件的 CRUD 操作，分享链接管理，以及删除时的物理文件引用检查（确保跨租户 MD5 去重正确性）。

前端模块：web/src/modules/storage/
概述
- StorageManagement 组件：支持拖拽上传、多文件上传、右键菜单（重命名/复制/粘贴/分享/删除）
- useStorage Hook：提供节点 CRUD 和分享操作
- useStorageClipboardStore：管理复制/粘贴的 resourceId 列表
- useResourceUpload：提供统一上传能力（智能分片、进度、断点续传）
