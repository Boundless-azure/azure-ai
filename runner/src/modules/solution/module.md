# Runner Solution 模块

**模块路径**: `runner/src/modules/solution/`

## 模块功能描述

提供 Runner 本地 Solution 的管理功能，包括 Solution 的查看、安装、删除、升级、搜索等操作。

## 关键词索引

- Solution 管理 -> solution.service.ts, solution.routes.ts
- Solution 安装 -> solution.routes.ts (POST /solutions/install)
- Solution 删除 -> solution.routes.ts (DELETE /solutions/:name)
- Solution 升级 -> solution.routes.ts (POST /solutions/:name/upgrade)
- Solution 搜索 -> solution.routes.ts (GET /solutions/search/query)
- Solution 列表 -> solution.routes.ts (GET /solutions)

## 模块文件

- `types/solution.types.ts` - 类型定义
- `services/solution.service.ts` - 业务逻辑服务
- `routes/solution.routes.ts` - 路由处理

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /solutions | 获取已安装的 Solution 列表 |
| GET | /solutions/:name | 获取 Solution 详情 |
| POST | /solutions/install | 安装 Solution |
| DELETE | /solutions/:name | 删除 Solution |
| POST | /solutions/:name/upgrade | 升级 Solution |
| GET | /solutions/search/query | 搜索 Solution |

## Solution 信息结构

```typescript
interface SolutionInfo {
  name: string;           // Solution 名称
  version: string;        // Solution 版本号
  source: 'self_developed' | 'marketplace';  // 来源
  location: string;      // Runner 内绝对路径
  summary: string;       // Solution 简述
  description: string;   // Solution 详情 (markdown)
  images: string[];      // 图片列表
  includes: ('app' | 'unit' | 'workflow' | 'agent')[];  // 包含内容
  installedAt?: string;  // 安装时间
}
```
