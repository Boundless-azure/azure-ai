/**
 * @title Auth Service
 * @description Provides login and authentication related API calls.
 * @keywords-cn 认证服务, 登录, API
 * @keywords-en auth-service, login, api
 */

import { http } from '../../../utils/http';
import type { LoginResponse } from '../types/auth.types';

export const authService = {
  /**
   * Login with credentials
   * @param data Login payload
   */
  login: (data: Record<string, any>) =>
    http.post<LoginResponse>('/auth/login', data),
};
