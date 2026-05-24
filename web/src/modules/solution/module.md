# Solution 模块 (Web)

**模块路径**: `web/src/modules/solution/`

## 模块功能描述

Solution 管理前端。三个 Tab :: 我的解决方案 / 解决方案市场 / 我的购买。

- **我的解决方案** :: 不再选 Runner, 后端跨所有 mounted Runner 聚合真实数据展示;
  顶部 toolbar 显示在线 Runner 数 + 刷新按钮; 仍提供详情查看与按 Runner 卸载。
- **解决方案市场** :: 暂关闭, 占位卡片"正在开发"。
- **我的购买** :: 暂关闭, 占位卡片"正在开发"。

## 关键词索引

- 解决方案聚合列表 -> SolutionManagement.vue (My Solutions Tab)
- 解决方案市场占位 -> SolutionManagement.vue (Marketplace Tab, 开发中)
- 我的购买占位 -> SolutionManagement.vue (My Purchases Tab, 开发中)
- Solution 操作 hook -> useSolutions.ts
- Solution API -> ../../api/solution.ts

## 模块文件

- `components/SolutionManagement.vue` - 主组件
- `hooks/useSolutions.ts` - Solution composable
- `types/solution.types.ts` - 类型定义
- `constants/solution.constants.ts` - 常量
- `solution.module.ts` - 模块导出

## 组件结构

```
SolutionManagement.vue
├── Header
├── Tabs (我的解决方案 / 解决方案市场 / 我的购买)
│
├── [My Solutions Tab]                  # 真实数据
│   ├── 聚合提示条 (在线 Runner 数 + 刷新)
│   ├── 搜索框
│   ├── Solution 卡片网格
│   └── 分页控件
│
├── [Marketplace Tab]                   # 开发中占位
└── [My Purchases Tab]                  # 开发中占位
│
├── [Install Modal]                     # 仅留 API, 入口暂闭
├── [Uninstall Modal]
└── [Detail Modal]
```

## 核心函数

### components/SolutionManagement.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `handleSearch` | 提交搜索, 重置到第 1 页 |
| `handlePageChange` | 切换 my-solutions 分页 |
| `reloadSolutions` | 同时刷新 runners 列表与 Solution 列表 |
| `openDetail` | 打开 Solution 详情 |
| `openUninstall` | 打开卸载弹窗 |
| `confirmUninstall` | 提交卸载 |
| `quickUninstallFromRunner` | 详情页中按 Runner 单点卸载 |
| `getRunnerAlias` | runnerId → alias 展示 |
| `onlineRunnerCount` | 在线 Runner 数 (computed) |

### hooks/useSolutions.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `loadSolutions` | 拉取聚合后的 Solution 列表 |
| `loadRunners` | 拉取 Runner 列表 |
| `installSolution` | 安装到指定 Runner |
| `uninstallSolution` | 从指定 Runner 卸载 |
| `setPage` | 设置 my-solutions 当前页 |
| `loadMarketplaceSolutions` | (保留) 市场列表, 当前 UI 不再调用 |
| `loadPurchases` | (保留) 购买记录, 当前 UI 不再调用 |
| `loadTags` | (保留) 标签列表, 当前 UI 不再调用 |

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `useSolutions.loadSolutions` | `web_solution_load_001` |
| `useSolutions.loadRunners` | `web_solution_load_runners_002` |
| `useSolutions.installSolution` | `web_solution_install_003` |
| `useSolutions.uninstallSolution` | `web_solution_uninstall_004` |
| `SolutionManagement.reloadSolutions` | `web_solution_reload_005` |
| `SolutionManagement.openUninstall` | `web_solution_open_uninstall_006` |
