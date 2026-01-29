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
  email?: string | null;
  phone?: string | null;
  tenantId?: string | null;
}

export interface LoginResponse {
  token: string;
  principal: Principal;
  ability: {
    rules: AbilityRule[];
  };
}
