# API Module（前端 API 封装）

## 功能描述

统一封装前端访问后端的 HTTP API，负责参数校验、路径拼接与类型返回。

## 文件路径

- `agent.ts` - Agent、Identity、AI Provider 等业务 API 聚合封装。
- `resource.ts` - resources 表上传、访问与会话文件列表 API 封装。
- `storage.ts` - 存储资源相关 API 封装。
- `todo.ts` - Todo 增删改查与会话绑定 API 封装。

## 核心文件与函数

### agent.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `listUsers` | 查询用户管理列表 |
| `createUser` | 创建用户并可设置初始密码 |
| `updateUser` | 更新用户资料并可重置密码 |
| `deleteUser` | 删除用户 |

### resource.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `asBaseResponse` | 兼容资源接口原始响应与统一包装响应 |
| `list` | 查询 resources 表资源列表，支持 sessionId 过滤 |
| `upload` | 资源上传，可写入 sessionId |
| `smartUpload` | 智能上传并透传 sessionId |

### todo.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `list` | 查询待办列表，支持 sessionId 过滤 |
| `create` | 创建待办，可写入 sessionId |
| `update` | 更新待办，可绑定或解绑 sessionId |
