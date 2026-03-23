# Runner FRPC 模块

## 功能描述

管理 FRP Client 的配置生成和进程启动。

## 文件路径

- `runner/src/modules/frpc/routes/frpc.routes.ts` - FRPC 路由
- `runner/src/modules/frpc/services/frpc.service.ts` - FRPC 服务
- `runner/src/modules/frpc/types/frpc.types.ts` - FRPC 类型

## 函数列表

### frpc.routes.ts
- `registerFrpcRoutes` - 注册 FRPC 路由

### frpc.service.ts
- `FrpcService.generateConfig` - 生成 FRPC 配置文件
- `FrpcService.start` - 启动 FRPC
- `FrpcService.stop` - 停止 FRPC
- `FrpcService.reload` - 重载配置
- `FrpcService.addProxy` - 添加代理
- `FrpcService.removeProxy` - 移除代理
- `FrpcService.isRunning` - 检查运行状态
