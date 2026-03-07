/**
 * @title Auth Types
 * @description Type definitions for authentication module.
 * @keywords-cn 认证类型, 接口定义
 * @keywords-en auth-types, interface-definitions
 */

export interface AbilityRule {
  subject: string;
  action: string;
  conditions?: Record<string, unknown>;
}

export interface Principal {
  id: string;
  displayName: string;
  principalType: string;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  tenantId?: string | null;
}

/**
 * @title Change Password DTO
 * @description 修改登录密码请求体。
 * @keywords-cn 修改密码, 请求体, 登录密码
 * @keywords-en change-password, dto, login-password
 */
export interface ChangePasswordDto {
  currentPassword: string;
  nextPassword: string;
}

export interface LoginResponse {
  token: string;
  principal: Principal;
  ability: {
    rules: AbilityRule[];
  };
}
