# Runner Control 模块

## 功能描述

提供 Runner 控制面板的 Fastify 路由，包括 Solution、应用域名、应用、FRPC 管理和性能统计接口。

## 文件路径

- `runner/src/modules/runner-control/runner-control.routes.ts` - 路由定义
- `runner/src/modules/runner-control/services/stats.service.ts` - 性能统计服务
- `runner/src/modules/runner-control/services/token.service.ts` - Token 验证服务

## 函数列表

### runner-control.routes.ts

#### Solution 接口
- `GET /runner-control/solutions` - 获取 Solution 列表
- `GET /runner-control/solutions/:id` - 获取单个 Solution
- `POST /runner-control/solutions` - 创建 Solution
- `PUT /runner-control/solutions/:id` - 更新 Solution
- `DELETE /runner-control/solutions/:id` - 删除 Solution

#### 应用域名接口
- `GET /runner-control/app-domains` - 获取应用域名列表
- `POST /runner-control/app-domains` - 创建应用域名
- `PUT /runner-control/app-domains/:domain` - 更新应用域名
- `DELETE /runner-control/app-domains/:domain` - 删除应用域名

#### 应用管理接口
- `GET /runner-control/apps` - 获取应用列表
- `GET /runner-control/apps/:id` - 获取单个应用
- `POST /runner-control/apps` - 创建应用
- `PUT /runner-control/apps/:id` - 更新应用
- `DELETE /runner-control/apps/:id` - 删除应用

#### 性能面板接口
- `GET /runner-control/stats` - 获取性能统计

#### FRPC 接口
- `GET /runner-control/frpc/status` - 获取 FRPC 状态
- `POST /runner-control/frpc/start` - 启动 FRPC
- `POST /runner-control/frpc/stop` - 停止 FRPC
- `POST /runner-control/frpc/reload` - 重载 FRPC

### services/stats.service.ts
- `RunnerStatsService.getStats` - 获取系统性能统计

### services/token.service.ts
- `RunnerTokenService.validateToken` - 验证 Token
- `RunnerTokenService.getInstance` - 获取单例实例

## 安全特性

- 所有 `/runner-control/*` 路由都需要 Token 验证
- Token 通过 Authorization header 或 query.token 传递
- 无效 Token 返回 404

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `registerRunnerControlRoutes` | `runner_ctrl_register_001` |
| `RunnerStatsService.getStats` | `runner_stats_get_002` |
| `RunnerTokenService.validateToken` | `runner_token_validate_003` |
