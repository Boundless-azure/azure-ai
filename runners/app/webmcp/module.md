模块名称：app/webmcp（WebMCP 模块）

概述
- 提供 WebMCP 页面声明与操作的 Socket 协议网关（namespace: /webmcp/ws），前端页面通过 SDK 注册当前页面的声明；后端可请求最新声明并下发操作。
- 支持事件：webmcp/register（注册）、webmcp/get（请求描述）、webmcp/descriptor（回传描述）、webmcp/op（下发操作）、webmcp/op_result（操作回执）。

文件清单（File List）
- app/webmcp/webmcp.module.ts
- app/webmcp/controllers/webmcp.gateway.ts
- app/webmcp/services/webmcp.service.ts
- app/webmcp/services/webmcp.server.sdk.ts
- app/webmcp/types/webmcp.types.ts
- app/webmcp/enums/webmcp.enums.ts
- app/webmcp/cache/webmcp.cache.ts
 - app/webmcp/index.ts

函数清单（Function Index）
- WebMcpService.attachServer(server)
- WebMcpService.requestDescriptor(req, timeoutMs?)
- WebMcpService.dispatchOperation(op, timeoutMs?)
- WebMcpService.listRegisteredPages()
- WebMcpGateway.onRegister(payload, client)
- WebMcpGateway.onDescriptor(payload, client)

关键词索引（中文 / English Keyword Index）
WebMCP模块 -> app/webmcp/webmcp.module.ts
WebMCP网关 -> app/webmcp/controllers/webmcp.gateway.ts
WebMCP服务 -> app/webmcp/services/webmcp.service.ts
WebMCP服务端SDK -> app/webmcp/services/webmcp.server.sdk.ts
WebMCP类型 -> app/webmcp/types/webmcp.types.ts
WebMCP枚举 -> app/webmcp/enums/webmcp.enums.ts
WebMCP缓存 -> app/webmcp/cache/webmcp.cache.ts
WebMCP入口 -> app/webmcp/index.ts

快速检索映射（Keywords -> Files）
- "webmcp.module" / "WebMcpModule" -> src/app/webmcp/webmcp.module.ts
- "webmcp.gateway" / "WebMcpGateway" -> src/app/webmcp/controllers/webmcp.gateway.ts
- "webmcp.service" / "WebMcpService" -> src/app/webmcp/services/webmcp.service.ts
- "webmcp.types" / "WebMcp Types" -> src/app/webmcp/types/webmcp.types.ts
- "webmcp.enums" / "WebMcp Enums" -> src/app/webmcp/enums/webmcp.enums.ts
- "webmcp.cache" / "WebMcp Cache" -> src/app/webmcp/cache/webmcp.cache.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- WebMcpService.attachServer -> wm_attach_01
- WebMcpService.requestDescriptor -> wm_request_02
- WebMcpService.dispatchOperation -> wm_dispatch_03
- WebMcpService.listRegisteredPages -> wm_list_04
- WebMcpGateway.onRegister -> wm_gateway_register_05
- WebMcpGateway.onDescriptor -> wm_gateway_descriptor_06
- createWebMcpServerSDK.getDescriptor -> wm_sdk_getdesc_07
- createWebMcpServerSDK.dispatch -> wm_sdk_dispatch_08
- createWebMcpServerSDK.listPages -> wm_sdk_list_09

模块功能描述（Description）
WebMCP 模块通过 Socket.io 为页面声明（Page Declaration）与操作（Operation JSON）提供双向通道：后端可触发 getWebmcp 协议以获取当前页面声明；AI 根据声明生成操作 JSON，后端经 webmcp/op 下发到前端并等待回执。前端 SDK 支持 hook 调用与变量修改的前/后置监听。
