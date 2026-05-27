模块名称：app/common（公共能力模块）

概述（Overview）
- 跨业务公共 Web Component Hook 声明。
- countBoard 组件通过 `/api/hook-invoke` 端点动态调用任意 Hook 获取统计数据，以网格卡片展示并配数字滚动动画。
- 新增公共组件时在本模块扩展，不在各业务模块中散落。

文件清单（File List）
- app/common/services/common-components.service.ts
- app/common/common.module.ts

函数清单（Function Index）
- CommonComponentsService
  - countBoard (@HookComponent) — Web Component Hook: 网格卡片展示多个统计数字，payload 为数组 [{ hook, title, color? }]，每项通过 POST /api/hook-invoke 调用对应 Hook 获取 { count: number }，内置数字滚动动画 | keywords: count-board-web-component, stats-grid, common-components, web-component-hook-declaration

关键词索引（中文 / English Keyword Index）
统计看板组件 -> app/common/services/common-components.service.ts
count-board-web-component -> app/common/services/common-components.service.ts
stats-grid -> app/common/services/common-components.service.ts
common-module -> app/common/common.module.ts
数字滚动动画 -> app/common/services/common-components.service.ts
number-animation -> app/common/services/common-components.service.ts
公共模块 -> app/common/common.module.ts

模块功能描述（Description）
本模块提供跨业务公共 Web Component Hook，目前包含 saas.app.common.countBoard 统计看板组件。
LLM 可通过在回复中嵌入 hook fence 触发前端渲染，payload 为统计项数组，每项包含对应的 Hook 名称与卡片标题；
组件通过 `/api/hook-invoke` 端点调用各 Hook 拿到数量后以滚动动画展示，无需 LLM 手动查询数据。
