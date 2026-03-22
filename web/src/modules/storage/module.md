# Storage Module（资源库模块）

## 功能描述

资源库（Storage）模块，提供统一的文件/文件夹管理和分享功能。支持：
- 目录树结构管理（创建文件夹、进入目录、面包屑导航）
- 文件/文件夹上传（拖拽上传、多文件上传、断点续传）
- 右键菜单（重命名、复制、粘贴、分享、删除）
- 分享链接生成（永久分享、临时分享、密码分享）
- 剪贴板功能（复制资源 ID 到剪贴板，粘贴创建新节点）

## 目录结构

```
web/src/modules/storage/
├── api/
│   └── storage.ts                    # 存储 API 封装
├── components/
│   └── StorageManagement.vue          # 资源库管理主组件
├── hooks/
│   └── useStorage.ts                  # 存储 CRUD 操作 Hook
├── store/
│   └── clipboard.store.ts             # 资源剪贴板状态（Pinia）
├── types/
│   └── storage.types.ts               # TypeScript 类型定义
└── constants/
    └── storage.constants.ts           # 常量定义（分享模式标签等）
```

## 核心文件 & 函数

### api/storage.ts
| 函数名 | 关键词描述 |
|--------|-----------|
| `getRootNodes` | 获取根目录节点列表 |
| `listNodes` | 按 parentId 查询子节点 |
| `createNode` | 创建文件夹或文件节点 |
| `updateNode` | 更新节点名称/移动位置 |
| `deleteNode` | 软删除节点 |
| `createShare` | 创建分享链接 |
| `removeShare` | 删除分享链接 |
| `getShareContent` | 通过 Token 获取分享内容 |
| `storageUpload` | 资源库专用的上传接口（内部调用统一上传 + 创建 storage_node） |

### hooks/useStorage.ts
| 函数名 | 关键词描述 |
|--------|-----------|
| `loadRootNodes` | 加载根目录节点（调用 `/storage/nodes/root`） |
| `loadChildren` | 加载指定父节点的子节点（parentId=null 时自动调用根目录接口） |
| `createNode` | 创建节点并返回 |
| `updateNode` | 更新节点 |
| `deleteNode` | 删除节点 |
| `createShare` | 创建分享 |

### store/clipboard.store.ts
| 函数名 | 关键词描述 |
|--------|-----------|
| `copy` | 复制资源到剪贴板（可多个） |
| `addToClipboard` | 添加资源到剪贴板 |
| `clear` | 清空剪贴板 |

### components/StorageManagement.vue
主要区域：
- `toolbar` - 搜索、新建文件夹、上传、粘贴按钮
- `breadcrumb` - 面包屑导航
- `content / grid-view` - 文件网格视图（含拖拽上传）
- `upload-modal` - 上传弹窗（多文件拖拽）
- `create-folder-modal` - 新建文件夹弹窗
- `share-modal` - 分享链接弹窗
- `context-menu` - 右键菜单（重命名/复制/粘贴/分享/删除）
