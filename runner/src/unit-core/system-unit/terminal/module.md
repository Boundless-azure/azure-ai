# terminal — 终端命令执行能力

提供终端命令执行能力, 支持同步/异步模式, 进程池管理(上限8), 异步完成后自动回调 SaaS 对话。

## 文件列表

- `unit.hook.ts` — Hook 声明 (5个hook)
- `unit.core.ts` — Handler 映射
- `unit-core/terminal.types.ts` — 类型定义
- `unit-core/terminal.pool.ts` — 进程池管理
- `unit-core/terminal.ops.ts` — 核心操作

## Hook 清单

| Hook 名称 | 描述 | 关键词 |
|-----------|------|--------|
| `runner.unitcore.terminal.exec` | 执行终端命令 (sync/async) | terminal, exec, sync, async |
| `runner.unitcore.terminal.getStatus` | 查询执行状态 | terminal, status, query |
| `runner.unitcore.terminal.getOutput` | 获取完整执行记录 | terminal, output, stdout, stderr |
| `runner.unitcore.terminal.kill` | 终止运行中的进程 | terminal, kill, terminate |
| `runner.unitcore.terminal.getPoolStatus` | 查看进程池状态 | terminal, pool, capacity |

## 函数清单

### terminal.ops.ts
- `exec(ctx, payload)` — 执行命令, sync≤30s, async返回handleId并自动回调
- `getStatus(ctx, payload)` — 读记录文件返回状态
- `getOutput(ctx, payload)` — 读记录文件返回完整输出
- `kill(ctx, payload)` — 终止进程
- `getPoolStatus(ctx)` — 返回池状态 `{active, max, available}`

### terminal.pool.ts
- `TerminalPool.spawn(command, options)` — spawn子进程, cwd=workspace
- `TerminalPool.kill(handleId)` — SIGTERM指定进程
- `TerminalPool.getPoolStatus()` — 池容量信息
- `TerminalPool.getRecord(handleId)` — 读.json记录文件
- `TerminalPool.cleanupAll()` — 终止所有活跃进程
- `TerminalPool.destroy()` — 销毁池+清理定时器

## 设计约束

- cwd 强制为 workspace 目录
- 进程池上限 8, 超出返回"终端繁忙"
- 记录文件存于 `<workspace>/.terminal-records/<handleId>.json`, 24h 自动清理
- 同步超时 30s, 自动转异步; 异步默认超时 5min
- 异步完成后通过 `ctx.callSaaSHook` 调用 `saas.app.conversation.sendMsg` 发送 Notification
