/**
 * @title Identity 常量
 * @description 身份模块的事件名与默认分页配置，供 hooks/组件复用。
 * @keywords-cn 身份常量, 事件, 分页
 * @keywords-en identity-constants, events, pagination
 */

export const IDENTITY_EVENT_NAMES = {
  principalsChanged: 'identity:principals-changed',
  organizationsChanged: 'identity:organizations-changed',
  rolesChanged: 'identity:roles-changed',
  membershipsChanged: 'identity:memberships-changed',
  permissionsChanged: 'identity:permissions-changed',
};

export const IDENTITY_DEFAULTS = {
  pageSize: 50,
};

export type IdentityEventName = keyof typeof IDENTITY_EVENT_NAMES;

export const PrincipalTypes = {
  UserEnterprise: 'user_enterprise',
  UserConsumer: 'user_consumer',
  OfficialAccount: 'official_account',
  Agent: 'agent',
  System: 'system',
} as const;

export const MembershipRoles = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
} as const;
