# Solution 模块

**模块路径**: `web/src/modules/solution/`

## 模块功能描述

Solution 管理模块前端，提供解决方案的查看、市场浏览和购买功能界面。

## 关键词索引

- 解决方案管理 -> SolutionManagement.vue, useSolutions.ts
- 解决方案市场 -> SolutionManagement.vue (marketplace tab)
- 我的解决方案 -> SolutionManagement.vue (my-solutions tab)
- 我的购买 -> SolutionManagement.vue (my-purchases tab)

## 模块文件

- `components/SolutionManagement.vue` - 解决方案管理主组件
- `hooks/useSolutions.ts` - 解决方案操作 Hook
- `types/solution.types.ts` - TypeScript 类型定义
- `constants/solution.constants.ts` - 常量定义
- `solution.module.ts` - 模块导出

## 组件结构

```
SolutionManagement.vue
├── Header (解决方案管理)
├── Tabs (我的解决方案 / 解决方案市场 / 我的购买)
│
├── [My Solutions Tab]
│   ├── Runner 筛选器
│   ├── 搜索框
│   ├── 解决方案列表 (grid)
│   └── 分页控件
│
├── [Marketplace Tab]
│   ├── 标签筛选侧边栏
│   ├── 搜索框
│   ├── 市场解决方案列表 (grid)
│   └── 分页控件
│
├── [My Purchases Tab]
│   ├── 购买记录列表
│   └── 安装/卸载按钮
│
├── [Install Modal]
├── [Uninstall Modal]
└── [Detail Modal]
```

## API 挂载函数

- `listSolutions(query)` - 获取我的解决方案列表
- `listMarketplaceSolutions(query)` - 获取市场解决方案列表
- `getSolution(id)` - 获取解决方案详情
- `createSolution(data)` - 创建解决方案
- `updateSolution(id, data)` - 更新解决方案
- `deleteSolution(id)` - 删除解决方案
- `installSolution(id, runnerIds)` - 安装到 Runner
- `uninstallSolution(id, runnerIds)` - 从 Runner 卸载
- `getPurchases()` - 获取购买记录
- `purchaseSolution(data)` - 购买解决方案
- `getTags()` - 获取标签列表
- `getRunners()` - 获取 Runner 列表
