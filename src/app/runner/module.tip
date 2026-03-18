模块名称：app/runner（Runner 管理与注册模块）

概述
- 提供 Runner 的增删改查接口。
- 创建 Runner 时自动创建主体账号（principal）并生成注册 key。
- 提供 Runner 专用 WebSocket 网关用于注册握手，并维护在线/离线状态。
- 启动时注册现有功能块的基础 Hook 占位处理器。

文件清单（File List）
- app/runner/entities/runner.entity.ts
- app/runner/enums/runner.enums.ts
- app/runner/types/runner.types.ts
- app/runner/services/runner.service.ts
- app/runner/services/runner-hook-register.service.ts
- app/runner/controllers/runner.controller.ts
- app/runner/controllers/runner.gateway.ts
- app/runner/runner.module.ts

函数清单（Function Index）
- RunnerService
  - list(query)
  - get(id)
  - create(dto)
  - update(id, dto)
  - delete(id)
  - verifyRegistration(runnerId, key)
  - markStatus(id, status)
- RunnerGateway
  - onRegister(payload, client)
  - handleDisconnect(client)
- RunnerHookRegisterService
  - onModuleInit()

关键词索引（中文 / English Keyword Index）
Runner实体 -> app/runner/entities/runner.entity.ts
Runner状态 -> app/runner/enums/runner.enums.ts
Runner类型 -> app/runner/types/runner.types.ts
Runner服务 -> app/runner/services/runner.service.ts
Runner注册网关 -> app/runner/controllers/runner.gateway.ts
Runner控制器 -> app/runner/controllers/runner.controller.ts
Runner模块 -> app/runner/runner.module.ts
Hook注册初始化 -> app/runner/services/runner-hook-register.service.ts
runner-entity -> app/runner/entities/runner.entity.ts
runner-types -> app/runner/types/runner.types.ts
runner-service -> app/runner/services/runner.service.ts
runner-gateway -> app/runner/controllers/runner.gateway.ts
runner-controller -> app/runner/controllers/runner.controller.ts
runner-module -> app/runner/runner.module.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- RunnerService.create -> runner_create_001
- RunnerService.verifyRegistration -> runner_verify_registration_002
- RunnerService.markStatus -> runner_mark_status_003
- RunnerGateway.onRegister -> runner_gateway_register_004
- RunnerGateway.handleDisconnect -> runner_gateway_disconnect_005
- RunnerHookRegisterService.onModuleInit -> runner_hook_bootstrap_006

模块功能描述（Description）
Runner 模块用于支撑脱离 SaaS 主进程的执行端管理：平台可创建 Runner、绑定主体账号并下发注册 key；Runner 客户端使用 key 进行注册握手后进入在线状态，断连自动回落离线。模块内置基础 Hook 注册入口，便于后续将更多业务块接入 Runner 编排流程。
