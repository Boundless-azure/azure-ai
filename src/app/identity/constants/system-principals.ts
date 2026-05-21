/**
 * @title 系统主体固定 ID 常量
 * @description 全局共享的 PrincipalType.System 主体 ID 常量出口。供"系统主动发起 + UI 隐藏 + agent 可见"的隐藏通知场景共用(数据触点 / 主动 AI 推送 / 系统告警 / 定时摘要 等)。
 * @keywords-cn 系统主体, 通知主体, 固定ID, 系统通知, 隐藏通知
 * @keywords-en system-principal, notifier, fixed-id, system-notify, hidden-notification
 */

/**
 * 全局系统通知主体 ID(`ai-notify`)
 *
 * - 由 migration `1769912000000-SystemNotifyFixedEntry` 启动期 seed
 * - principalType = `system`,displayName = `系统通知`
 * - 跨租户 / 跨群共享,sendMessage 对此 ID 跳过 isMember 校验
 * - 配套消息类型必须使用 `messageType = 'notification'`(UI 隐藏 / LLM 上下文可见)
 * - 用法约束:仅供受信任服务端代码触发(hook handler / migration / job),禁止 LLM 链路直接借用
 *
 * @keyword-en system-notifier-id
 */
export const SYSTEM_NOTIFIER_ID = 'ai-notify';
