import { http } from '../../../utils/http';
import type { LoginResponse } from '../types/auth.types';

export const authService = {
  login: (data: Record<string, any>) =>
    http.post<LoginResponse>('/auth/login', data),
};
