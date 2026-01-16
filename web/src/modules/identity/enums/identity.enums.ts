/**
 * @title Identity Enums (Web)
 * @description 前端身份模块的枚举类型。
 * @keywords-cn 主体类型枚举, 成员角色枚举
 * @keywords-en principal-type-enum, membership-role-enum
 */

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

export type PrincipalTypeEnum = typeof PrincipalTypes[keyof typeof PrincipalTypes];
export type MembershipRoleEnum = typeof MembershipRoles[keyof typeof MembershipRoles];
