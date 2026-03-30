模块名称：app/runner（Runner 管理与注册模块）

概述
- 提供 Runner 的增删改查接口。
- 创建 Runner 时自动创建主体账号（principal）并生成注册 key，同时分配默认域名。
- 提供 Runner 专用 WebSocket 网关用于注册握手、FRP 分配（含 token 返回）及在线状态维护。
- 提供 Runner 面板代理接口（域名、应用、Solution、统计、FRP 管理）。
- 提供奖励记录能力，用于记录免费域名等奖励的发放。
- 提供 frps HTTP 插件回调接口，对 Login/NewProxy 进行二次鉴权（runner_key + port 校验）。

文件清单（File List）
- app/runner/entities/runner.entity.ts
- app/runner/entities/frp-node.entity.ts         # 含 token 字段
- app/runner/entities/frp-record.entity.ts
- app/runner/entities/domain-binding.entity.ts
- app/runner/entities/reward-record.entity.ts
- app/runner/enums/runner.enums.ts
- app/runner/enums/reward.enums.ts
- app/runner/types/runner.types.ts
- app/runner/services/runner.service.ts
- app/runner/services/runner-frp.service.ts
- app/runner/services/runner-frp-node.service.ts  # allocateFrpRecord 返回 token
- app/runner/services/runner-domain.service.ts
- app/runner/services/domain-allocation.service.ts
- app/runner/services/reward-record.service.ts
- app/runner/services/runner-proxy.service.ts
- app/runner/services/runner-hook-register.service.ts
- app/runner/controllers/runner.controller.ts
- app/runner/controllers/runner.gateway.ts        # onRegister 返回 frpsToken
- app/runner/controllers/runner.proxy.controller.ts
- app/runner/controllers/reward-record.controller.ts
- app/runner/controllers/frp-plugin.controller.ts # NEW: frps HTTP plugin 鉴权
- app/runner/runner.module.ts

函数清单（Function Index）
- RunnerService
  - list(query) - Runner 列表查询
  - get(id) - 根据 ID 查询 Runner
  - create(dto) - 创建 Runner（生成 key、创建 principal、分配默认域名）
  - update(id, dto) - 更新 Runner
  - delete(id) - 软删除 Runner
  - verifyRegistration(runnerId, key) - 验证 Runner 注册
  - markStatus(id, status) - 更新 Runner 状态
- RunnerGateway
  - onRegister(payload, client) - Runner 客户端注册握手
  - onFrpStart(payload, client) - FRP 启动指令
  - onFrpStop(payload, client) - FRP 停止指令
  - onFrpReload(payload, client) - FRP 重载指令
  - handleDisconnect(client) - Runner 断连处理
- RunnerProxyService
  - getRunner(runnerId) - 获取 Runner 基础信息
  - getStats(runnerId) - 获取性能统计
  - listDomains(runnerId) - 获取域名列表
  - createDomain(runnerId, domain, pathPattern) - 创建域名绑定
  - deleteDomain(runnerId, domainId) - 删除域名绑定
  - listApps(runnerId) - 获取应用列表
  - listSolutions(runnerId) - 获取 Solution 列表
  - getFrpStatus() - 获取 FRP 状态
  - startFrp(runnerId) - 启动 FRP
  - stopFrp(runnerId) - 停止 FRP
  - reloadFrp(runnerId) - 重载 FRP
  - claimFreeDomain(runnerId) - 领取免费域名
- RunnerDomainService
  - list(runnerId) - 获取域名绑定列表
  - create(runnerId, tenantId, domain, pathPattern) - 创建域名绑定
  - delete(id) - 删除域名绑定
  - findByDomain(domain) - 根据域名查询
  - countByRunnerId(runnerId) - 统计域名数量
- DomainAllocationService
  - allocateDefaultDomain(runnerId, tenantId) - 分配默认域名（localhost:3001 + runnerId）
- RewardRecordService
  - create(rewardType, relatedId, description) - 创建奖励记录
  - existsByTypeAndRelatedId(rewardType, relatedId) - 查询奖励是否已发放
  - findByTypeAndRelatedId(rewardType, relatedId) - 查询奖励记录
- RewardRecordController
  - exists(rewardType, relatedId) - 检查奖励是否已发放
  - create(body) - 发放奖励
- RunnerFrpService
  - allocatePort(runnerId, domain) - 分配 FRP 端口
  - findByRunnerId(runnerId) - 查询 FRP 记录
  - findByDomain(domain) - 根据域名查询 FRP 记录
  - releasePort(runnerId) - 释放 FRP 端口
- RunnerHookRegisterService
  - onModuleInit() - Hook 注册初始化

关键词索引（中文 / English Keyword Index）
Runner实体 -> app/runner/entities/runner.entity.ts
FRP记录实体 -> app/runner/entities/frp-record.entity.ts
域名绑定实体 -> app/runner/entities/domain-binding.entity.ts
奖励记录实体 -> app/runner/entities/reward-record.entity.ts
Runner状态枚举 -> app/runner/enums/runner.enums.ts
奖励类型枚举 -> app/runner/enums/reward.enums.ts
Runner服务 -> app/runner/services/runner.service.ts
Runner注册网关 -> app/runner/controllers/runner.gateway.ts
Runner代理控制器 -> app/runner/controllers/runner.proxy.controller.ts
Runner代理服务 -> app/runner/services/runner-proxy.service.ts
Runner控制器 -> app/runner/controllers/runner.controller.ts
Runner模块 -> app/runner/runner.module.ts
域名分配服务 -> app/runner/services/domain-allocation.service.ts
奖励记录服务 -> app/runner/services/reward-record.service.ts
奖励记录控制器 -> app/runner/controllers/reward-record.controller.ts
Hook注册初始化 -> app/runner/services/runner-hook-register.service.ts
runner-entity -> app/runner/entities/runner.entity.ts
runner-service -> app/runner/services/runner.service.ts
runner-gateway -> app/runner/controllers/runner.gateway.ts
runner-proxy-service -> app/runner/services/runner-proxy.service.ts
domain-allocation -> app/runner/services/domain-allocation.service.ts
reward-record -> app/runner/services/reward-record.service.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- RunnerService.create -> runner_create_001
- RunnerService.verifyRegistration -> runner_verify_registration_002
- RunnerService.markStatus -> runner_mark_status_003
- RunnerGateway.onRegister -> runner_gateway_register_004
- RunnerGateway.handleDisconnect -> runner_gateway_disconnect_005
- RunnerProxyService.getStats -> runner_proxy_stats_007
- RunnerProxyService.listDomains -> runner_proxy_list_domains_008
- RunnerProxyService.createDomain -> runner_proxy_create_domain_009
- RunnerProxyService.deleteDomain -> runner_proxy_delete_domain_010
- RunnerProxyService.claimFreeDomain -> runner_proxy_claim_free_domain_015
- RunnerProxyService.getFrpStatus -> runner_proxy_frp_status_011
- RunnerProxyService.startFrp -> runner_proxy_frp_start_012
- RunnerProxyService.stopFrp -> runner_proxy_frp_stop_013
- RunnerProxyService.reloadFrp -> runner_proxy_frp_reload_014
- DomainAllocationService.allocateDefaultDomain -> domain_allocate_default_016
- RewardRecordService.create -> reward_create_017
- RewardRecordService.existsByTypeAndRelatedId -> reward_exists_018

模块功能描述（Description）
Runner 模块用于支撑脱离 SaaS 主进程的执行端管理：平台可创建 Runner、绑定主体账号并下发注册 key；Runner 客户端使用 key 进行注册握手后进入在线状态，断连自动回落离线。模块提供 Runner 面板代理接口用于管理域名（支持领取免费域名奖励）、应用、Solution、统计和 FRP 控制。
