# Runner Solution 模块

**模块路径**: `runner/src/modules/solution/`

## 模块功能描述

提供 Runner 本地 Solution 的管理能力 (查看 / 安装 / 删除 / 升级 / 搜索)。
除原有 HTTP 路由外, 同时把核心查询能力暴露为 HookBus hook
(`runner.app.solution.list / .get / .search`), 供 SaaS 通过双向 RPC
跨进程聚合多 Runner 的真实数据 (前端解决方案管理页就是这条链路)。

## 关键词索引

- Solution HTTP 路由 -> solution.routes.ts
- Solution 服务 -> solution.service.ts (Mongo + fs)
- Solution Hook 注册 -> hooks/solution.hooks.ts (registerSolutionHooks)
- 跨进程聚合入口 -> SaaS 端 RunnerHookRpcService.callHook(runnerId, 'runner.app.solution.list')
- Solution 安装 -> solution.routes.ts (POST /solutions/install) · solution.service.ts (install)
- Solution 删除 -> solution.routes.ts (DELETE /solutions/:name)
- Solution 升级 -> solution.routes.ts (POST /solutions/:name/upgrade)
- Solution 搜索 -> hooks/solution.hooks.ts (runner.app.solution.search)

## 模块文件

- `types/solution.types.ts` - 类型与 Zod schema
- `services/solution.service.ts` - 业务逻辑 (Mongo collection + workspace/solutions)
- `routes/solution.routes.ts` - HTTP 路由
- `hooks/solution.hooks.ts` - HookBus hook 注册 (在 app.ts 启动时调用)

## HTTP API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /solutions | 已安装 Solution 列表 |
| GET | /solutions/:name | Solution 详情 |
| POST | /solutions/install | 安装 Solution |
| DELETE | /solutions/:name | 删除 Solution |
| POST | /solutions/:name/upgrade | 升级 Solution |
| GET | /solutions/search/query | 搜索 Solution |

## HookBus Hook

| Hook 名 | 描述 | payload |
|---------|------|---------|
| runner.app.solution.list | 列出当前 Runner 的所有 Solution | { source? } |
| runner.app.solution.get | 取指定名称的 Solution | { name } |
| runner.app.solution.search | 按 q / source / include 搜索 | { q?, source?, include? } |

## 核心函数

### services/solution.service.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `list` | 列出已安装 Solution |
| `getByName` | 按名称取详情 |
| `install` | 物理写入 workspace/solutions/<name> + Mongo upsert |
| `delete` | 删目录 + Mongo deleteOne |
| `upgrade` | 重置目录 + 更新 installedAt |
| `search` | Mongo $regex / source / include 搜索 |

### hooks/solution.hooks.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `registerSolutionHooks` | 把 list/get/search 三个 hook 挂到 HookBus, 重复挂载安全 |

## Solution 信息结构

```typescript
interface SolutionInfo {
  name: string;
  version: string;
  source: 'self_developed' | 'marketplace';
  location: string;       // workspace/solutions/<name>
  summary: string;
  description: string;
  images: string[];
  includes: ('app' | 'unit' | 'workflow' | 'agent')[];
  installedAt?: string;
}
```
