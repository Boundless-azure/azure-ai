/**
 * @title Fixed Entry Constants
 * @description Agent 聊天固定入口默认资源路径。
 * @keywords-cn 固定入口, 默认头像, Azure助手, 系统通知
 * @keywords-en fixed-entry, default-avatar, azure-assistant, system-notify
 */

export const AZURE_AI_AVATAR_URL = '/static/system/avatars/azure-ai.png';
export const SYSTEM_NOTIFY_AVATAR_URL =
  '/static/system/avatars/system-notify.png';

export const FIXED_ENTRY_AVATAR_URLS = {
  'azure-ai': AZURE_AI_AVATAR_URL,
  'ai-notify': SYSTEM_NOTIFY_AVATAR_URL,
} as const;

export type FixedEntryId = keyof typeof FIXED_ENTRY_AVATAR_URLS;

/**
 * 解析固定入口默认头像路径。
 * @keyword-en resolve-fixed-entry-avatar-url
 */
export function resolveFixedEntryAvatarUrl(
  fixedId: string | null | undefined,
): string | null {
  if (!fixedId) return null;
  return FIXED_ENTRY_AVATAR_URLS[fixedId as FixedEntryId] ?? null;
}
