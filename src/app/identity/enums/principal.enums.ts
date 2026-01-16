/**
 * @title Principal 枚举
 * @description 统一身份类型与成员角色枚举。
 * @keywords-cn 主体类型, 成员角色
 * @keywords-en principal-type, membership-role
 */
export enum PrincipalType {
  UserEnterprise = 'user_enterprise',
  UserConsumer = 'user_consumer',
  OfficialAccount = 'official_account',
  Agent = 'agent',
  System = 'system',
}

export enum MembershipRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
}
