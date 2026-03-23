# Runner 代理模块

## 功能描述

提供 Runner 统一转发接口，根据域名动态路由到本地应用容器。

## 文件路径

- `runner/src/modules/proxy/proxy.routes.ts` - 代理路由注册
- `runner/src/modules/proxy/proxy.service.ts` - 代理服务（域名解析+转发）
- `runner/src/modules/proxy/types/proxy.types.ts` - 代理类型定义

## 函数列表

### proxy.routes.ts
- `registerProxyRoutes` - 注册代理路由 `/internal/forward`

### proxy.service.ts
- `ProxyService.resolveTarget` - 根据域名解析目标服务地址
- `ProxyService.forward` - 执行 HTTP 转发
