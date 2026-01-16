/**
 * @title 登录请求体
 * @description 使用邮箱或手机号+密码登录。
 * @keywords-cn 登录, 邮箱, 手机号, 密码
 * @keywords-en login, email, phone, password
 */
export interface LoginDto {
  email?: string;
  phone?: string;
  password: string;
}

/**
 * @title 登录响应体
 * @description 返回 JWT 令牌与主体信息。
 * @keywords-cn 登录响应, 令牌, 主体
 * @keywords-en login-response, token, principal
 */
export interface LoginResponse {
  token: string;
  principal: {
    id: string;
    displayName: string;
    principalType: string;
    email?: string | null;
    phone?: string | null;
    tenantId?: string | null;
  };
  ability: {
    rules: AbilityRule[];
  };
}

/**
 * @title JWT 载荷类型
 * @description 服务器签发与客户端解析的 JWT 载荷结构。
 * @keywords-cn JWT载荷, 用户主体, 鉴权
 * @keywords-en jwt-payload, user-principal, auth
 */
export interface JwtPayload {
  id: string;
  type: string;
}

/**
 * @title 能力规则
 * @description CASL 兼容的权限规则条目。
 * @keywords-cn 权限规则, CASL, 能力
 * @keywords-en ability-rule, casl, permission
 */
export interface AbilityRule {
  subject: string;
  action: string;
  conditions?: Record<string, unknown>;
}
