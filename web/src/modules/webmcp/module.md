# WebMCP Module（WebMCP 模块）

## 功能描述

WebMCP 前端模块提供页面声明、Socket 握手与操作分发的能力，以及供 SaaS 页面使用的前端 SDK。支持 setData 新格式（value getter + handle setter）、Zod 兼容 schema 校验、子页面 iframe postMessage 通信。

## 目录结构

```
src/modules/webmcp/
├── constants/
│   └── webmcp.constants.ts          # WebMCP 常量
├── description/
│   └── module.tip.ts                # 模块提示（开发用）
├── hooks/
│   └── useWebMCP.ts                 # WebMCP Hook
├── pages/
│   ├── WebMCPDemoPage.vue           # 完整演示页（4 Tab: 基础/表单/标签/子页面）
│   └── WebMCPChildPage.vue          # 子页面计数器（嵌入 iframe，postMessage 通信）
├── sdk/
│   └── webmcp-client.sdk.js         # 前端 SDK 源文件（UMD，同步自 public/）
├── types/
│   └── webmcp.types.ts              # 类型定义
└── webmcp.module.ts                 # 模块定义
```

## 核心文件与函数

### hooks/useWebMCP.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `declarePage` | 声明页面 |
| `connect` | 连接 |
| `registerCurrentPage` | 注册当前页面 |
| `useWebMCP` | 主入口 |

### sdk/webmcp-client.sdk.js（同步路径：web/public/webmcp-client.sdk.js）

| 函数/类名 | 关键词描述 |
|----------|-----------|
| `initWebMCP` | 初始化 SDK，返回 WebMcpInstance |
| `validateSchema` | schema 校验（Zod duck-type / 自定义 {type,enum,properties}） |
| `serializeSchema` | 序列化 schema 到描述符 |
| `getEntryValue` | 安全读取 data entry 当前值（优先 .value，否则 .handle） |
| `WebMcpInstance.setData` | 注册数据变量（新格式：{name,desc,schema?,value,handle}） |
| `WebMcpInstance.setEmit` | 注册动作（{name,desc,schema?,handle}） |
| `WebMcpInstance.getDescriptor` | 获取完整描述符（含 children） |
| `WebMcpInstance.reRegister` | 手动重新注册 |
| `WebMcpInstance.setDataValue` | 直接设置 data 值（含 schema 校验） |
| `WebMcpInstance.getDataValue` | 直接读取 data 当前值 |
| `WebMcpInstance.registerChildFrame` | 注册子页面 iframe，返回 cleanup 函数 |
| `handleOp.setData` | 执行 setData op（调用 entry.handle(value)） |
| `handleOp.callEmit` | 执行 callEmit op（含 schema 校验） |
| `handleOp.callChild` | 路由到子页面 iframe |
| `registerWebMCPComponents` | 注册 Web Components |
| `WebMcpFloatElement` | 悬浮 AI 球（`<webmcp-float>`） |
| `WebMcpDebugElement` | Debug 面板（`<webmcp-debug>`，含 Data/Emit tabs） |

### pages/WebMCPDemoPage.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `addLog` | 追加操作日志条目 |
| `LogPanel` | 内联日志面板组件（render 函数） |
| `filteredSelectOpts` | 下拉搜索过滤计算属性 |
| `handleReset` | 重置基础 Demo 数据 |
| `handleAlert` | 调用 alert 弹窗 |
| `pickSelectOption` | 选中下拉第 idx 项 |
| `validateForm` | 表单字段规则校验 |
| `handleFormValidate` | 触发验证并展示结果 |
| `handleFormSubmit` | 提交表单（含验证） |
| `handleFormReset` | 清空表单所有字段 |
| `newInnerTab` | 新建内部 Tab |
| `closeInnerTab` | 关闭指定 Tab |
| `reloadChild` | 重载子页面 iframe |
| `initMCP` | 初始化 WebMCP，注册所有 data + emit |
| `callChild` | 向子页面 iframe 转发 op（postMessage） |
| `onWindowMessage` | 监听 webmcp:child_ready 消息 |

### pages/WebMCPChildPage.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `addLog` | 追加日志 |
| `increment` | 计数 +1 |
| `decrement` | 计数 -1 |
| `resetCount` | 重置计数到 0 |
| `setCount` | 设置计数到指定值 |
| `replyParent` | 向父页面发送 op 执行结果 |
| `handleParentOp` | 处理父页面发来的 webmcp:op |
| `onWindowMessage` | 监听 message 事件 |
| `initChildMCP` | 初始化并通知父页面 child_ready |
