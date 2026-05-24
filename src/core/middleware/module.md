# core/middleware

404 域名转发异常过滤器模块。仅在 NestJS 路由无匹配（NotFoundException）时触发，
根据 Host 头查询域名绑定，按 `^pathPattern`（起始锚定）匹配路径，命中则反代至 Runner。

---

## 文件列表

### `core-middleware.module.ts`
NestJS 模块，通过 `APP_FILTER` 注册 ForwardingMiddleware 为全局异常过滤器。

### `forwarding.middleware.ts`
ExceptionFilter 实现（`@Catch(NotFoundException)`）。
- `ForwardingMiddleware.catch` — 异常过滤入口：仅处理 HTTP NotFoundException，执行转发逻辑
- `ForwardingMiddleware.getBindings` — 查询域名绑定列表（Redis 优先，回退 DB + 写缓存）
- `ForwardingMiddleware.matchBinding` — 按 `^pathPattern` 起始锚定正则匹配路径（修复误匹配问题）
- `ForwardingMiddleware.getTarget` — 查询 Runner FRP 目标 URL（Redis 优先，回退 DB + 写缓存）
- `ForwardingMiddleware.getProxy` — 按 targetUrl 获取或创建 http-proxy-middleware 实例

