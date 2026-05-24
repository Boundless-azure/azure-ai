# Runner Module（Runner 管理模块）

## 功能描述

Runner 前端模块提供管理页、CRUD hook 与 API 对接能力，支持真实数据和 WebSocket 通信。

## 目录结构

```
src/modules/runner/
├── api/
│   └── runner.ts                    # Runner API 封装（HTTP）
├── components/
│   ├── RunnerManagement.vue         # Runner 管理组件（列表、表单、Key展示）
│   ├── RunnerProxyPanel.vue         # 控制面板主容器（5个Tab）
│   └── tabs/
│       ├── PerformanceTab.vue       # 性能面板（CPU、内存、FRP控制）
│       ├── DomainTab.vue            # 域名管理
│       ├── AppDomainTab.vue         # 应用域名绑定
│       ├── AppTab.vue               # 应用管理
│       └── SolutionTab.vue          # Solution 管理
├── constants/
│   └── runner.constants.ts         # Runner 常量
├── hooks/
│   └── useRunners.ts               # Runner Hook（list/create/update/remove）
├── pages/
│   ├── RunnerPage.vue              # Runner 页面入口
│   └── RunnerProxyPage.vue         # 控制面板页面
├── services/
│   └── runner-ws.service.ts        # Runner WebSocket 服务（FRP控制）
├── types/
│   └── runner.types.ts             # 类型定义
└── runner.module.ts                # 模块定义
```

## 核心文件与函数

### hooks/useRunners.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `list` | 获取 Runner 列表 |
| `create` | 创建 Runner（自动持久化 runnerKey） |
| `update` | 更新 Runner |
| `remove` | 删除 Runner |

### services/runner-ws.service.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `connect` | 连接 Runner WebSocket |
| `startFrp` | 启动 FRP |
| `stopFrp` | 停止 FRP |
| `reloadFrp` | 重载 FRP 配置 |

### api/runner.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `runnerApi.list` | 获取 Runner 列表 |
| `runnerApi.get` | 获取单个 Runner |
| `runnerApi.create` | 创建 Runner |
| `runnerApi.update` | 更新 Runner |
| `runnerApi.delete` | 删除 Runner |
| `runnerPanelApi.getStats` | 获取性能统计 |
| `runnerPanelApi.listDomains` | 获取域名列表 |
| `runnerPanelApi.createDomain` | 创建域名绑定 |
| `runnerPanelApi.deleteDomain` | 删除域名绑定 |
| `runnerPanelApi.listApps` | 获取应用列表 |
| `runnerPanelApi.listSolutions` | 获取 Solution 列表 |
| `runnerPanelApi.getFrpStatus` | 获取 FRP 状态 |
| `runnerPanelApi.startFrp` | 启动 FRP |
| `runnerPanelApi.stopFrp` | 停止 FRP |
| `runnerPanelApi.reloadFrp` | 重载 FRP |

### components/RunnerManagement.vue

主要区域：
- `runner-list` - Runner 列表
- `runner-form` - Runner 表单
- `status-indicator` - 状态指示器
- `key-dialog` - Runner Key 展示弹窗
- `proxy-panel` - 控制面板入口

### components/RunnerProxyPanel.vue

主要区域：
- `tab-bar` - Tab 切换栏
- `performance-tab` - 性能面板
- `domain-tab` - 域名管理
- `app-domain-tab` - 应用域名
- `app-tab` - 应用管理
- `solution-tab` - Solution 管理

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `useRunners_list` | `web_runner_hook_list_001` |
| `useRunners_create` | `web_runner_hook_create_002` |
| `useRunners_update` | `web_runner_hook_update_003` |
| `useRunners_remove` | `web_runner_hook_remove_004` |
| `RunnerManagement_submit` | `web_runner_cmp_submit_005` |
| `RunnerSocketService_connect` | `web_runner_ws_connect_006` |
| `RunnerSocketService_startFrp` | `web_runner_ws_start_frp_007` |
| `RunnerSocketService_stopFrp` | `web_runner_ws_stop_frp_008` |
| `RunnerSocketService_reloadFrp` | `web_runner_ws_reload_frp_009` |
| `runnerPanelApi_getStats` | `web_runner_panel_stats_010` |
| `runnerPanelApi_listDomains` | `web_runner_panel_domains_011` |
| `runnerPanelApi_createDomain` | `web_runner_panel_create_domain_012` |
| `runnerPanelApi_deleteDomain` | `web_runner_panel_delete_domain_013` |
