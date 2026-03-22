# Solution 模块

**模块路径**: `src/app/solution/`

## 模块功能描述

Solution 管理模块，提供解决方案的 CRUD、市场浏览和购买功能。

## 关键词索引

- Solution 管理 -> solution.service.ts, solution.controller.ts
- Solution 创建 -> solution.controller.ts (POST /solutions)
- Solution 列表 -> solution.controller.ts (GET /solutions)
- Solution 市场 -> solution.controller.ts (GET /solutions/marketplace/list)
- Solution 安装 -> solution.controller.ts (POST /solutions/:id/install)
- Solution 卸载 -> solution.controller.ts (DELETE /solutions/:id/install)
- Solution 购买 -> solution.controller.ts (GET /solutions/purchases/list, POST /solutions/purchase)
- Solution 标签 -> solution.controller.ts (GET /solutions/tags/list)
- Runner 列表 -> solution.controller.ts (GET /solutions/runners)

## 模块文件

- `entities/solution.entity.ts` - Solution 实体
- `entities/solution-purchase.entity.ts` - Solution 购买记录实体
- `controllers/solution.controller.ts` - 控制器
- `services/solution.service.ts` - 服务
- `types/solution.types.ts` - 类型定义
- `enums/solution.enums.ts` - 枚举定义

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /solutions | 创建 Solution |
| GET | /solutions | 获取我的 Solutions |
| GET | /solutions/:id | 获取 Solution 详情 |
| PUT | /solutions/:id | 更新 Solution |
| DELETE | /solutions/:id | 删除 Solution |
| GET | /solutions/marketplace/list | 获取市场 Solution 列表 |
| POST | /solutions/:id/install | 安装到 Runner |
| DELETE | /solutions/:id/install | 从 Runner 卸载 |
| GET | /solutions/purchases/list | 获取购买记录 |
| POST | /solutions/purchase | 购买 Solution |
| GET | /solutions/runners | 获取 Runner 列表 |
| GET | /solutions/tags/list | 获取标签列表 |

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
}
```
