# Solution 模块 (SaaS)

**模块路径**: `src/app/solution/`

## 模块功能描述

Solution 管理模块。CRUD 落本地表 (TypeORM); 列表/标签/Runner 列表通过 RunnerHookRpcService
跨进程聚合所有 mounted Runner 上的真实数据 (`runner.app.solution.list` hook), 不再依赖 mock。
市场 (marketplace) 与"我的购买"(purchases) 暂为占位实现, 前端入口已切到"开发中"卡片。

所有控制器方法同时挂 `@CheckAbility` + `@HookLifecycle`, ability 元数据由
`HookLifecycleRegistrationService.resolveTarget` 自动镜像进 hook metadata.requiredAbility,
LLM 调用走 `HookAbilityMiddleware` 兜底鉴权。

## 关键词索引

- Solution 跨 Runner 聚合 -> solution.service.ts (aggregateFromRunners)
- Solution 列表查询 -> solution.controller.ts (GET /solutions, hook saas.app.solution.list)
- Solution 创建/更新/删除 -> solution.controller.ts
- Solution 安装 -> solution.controller.ts (POST /solutions/:id/install)
- Solution 卸载 -> solution.controller.ts (DELETE /solutions/:id/install)
- Solution 标签频次榜 -> solution.service.ts (getTags)
- Runner 列表 -> solution.service.ts (getRunners)
- 占位接口 (市场/购买) -> solution.service.ts (listMarketplace, getPurchases)

## 模块文件

- `entities/solution.entity.ts` - Solution 实体
- `entities/solution-purchase.entity.ts` - Solution 购买记录实体
- `controllers/solution.controller.ts` - 控制器 (Hook + CASL 双装饰器)
- `services/solution.service.ts` - 业务服务 (跨 Runner 聚合 + CRUD)
- `types/solution.types.ts` - 类型与 Zod schema
- `enums/solution.enums.ts` - 枚举定义

## API 端点 (与 Hook 同源)

| 方法 | 路径 | Hook | CASL |
|------|------|------|------|
| POST | /solutions | saas.app.solution.create | create:solution |
| GET | /solutions/:id | saas.app.solution.get | read:solution |
| PUT | /solutions/:id | saas.app.solution.update | update:solution |
| DELETE | /solutions/:id | saas.app.solution.delete | delete:solution |
| GET | /solutions | saas.app.solution.list | read:solution |
| GET | /solutions/marketplace/list | saas.app.solution.marketplaceList | read:solution |
| POST | /solutions/:id/install | saas.app.solution.install | install:solution |
| DELETE | /solutions/:id/install | saas.app.solution.uninstall | uninstall:solution |
| GET | /solutions/purchases/list | saas.app.solution.purchasesList | read:solution |
| POST | /solutions/purchase | saas.app.solution.purchase | purchase:solution |
| GET | /solutions/runners | saas.app.solution.getRunners | read:runner |
| GET | /solutions/tags/list | saas.app.solution.getTags | read:solution |

## 核心函数

### services/solution.service.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `create` | 创建 Solution (本地表) |
| `getById` | 取 Solution 详情 (本地表) |
| `update` | 更新 Solution |
| `delete` | 软删除 |
| `list` | 跨 Runner 聚合 + 内存分页/筛选 |
| `listMarketplace` | 占位, 返回空分页 (前端"开发中") |
| `install` | 维护本地 SolutionEntity.runnerIds |
| `uninstall` | 移除指定 runnerIds |
| `getTags` | 从聚合结果统计 tag 频次 |
| `getRunners` | 返回可见 Runner 列表 (alias / status) |
| `getPurchases` | 占位, 返回空数组 |
| `purchase` | 落购买记录 (前端入口暂关闭) |
| `aggregateFromRunners` | 拉所有 mounted Runner, 并行 callHook(runner.app.solution.list), 同名合并, 软跳过离线 |
| `extractSolutionItems` | 从 hook reply 提取 result[0].data.items |
| `normalizeRunnerSolution` | 把 Runner 端 SolutionInfo 标准化成 SaaS SolutionResponse |

## Solution 信息结构 (前端展示侧)

```typescript
interface SolutionResponse {
  id: string;          // 聚合时拼装为 `<runnerId>::<name>@<version>`
  runnerIds: string[]; // 同一 Solution 在多 Runner 上时累加
  name: string;
  version: string;
  source: 'self_developed' | 'marketplace';
  location: string | null;
  summary: string | null;
  description: string | null;
  includes: ('app' | 'unit' | 'workflow' | 'agent')[] | null;
  ...
}
```
