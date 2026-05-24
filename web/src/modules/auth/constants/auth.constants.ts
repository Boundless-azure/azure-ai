/**
 * @title Auth 常量
 * @description 统一认证相关的存储键与事件名。
 * @keywords-cn 认证常量, 存储键, 事件
 * @keywords-en auth-constants, storage-keys, events
 */

export const AUTH_STORAGE_KEYS = {
  token: 'token',
  principal: 'principal',
  abilityRules: 'abilityRules',
};

export const AUTH_EVENT_NAMES = {
  loggedIn: 'auth:logged-in',
  loggedOut: 'auth:logged-out',
};

export type AuthEventName = keyof typeof AUTH_EVENT_NAMES;

