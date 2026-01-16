import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { AuthService } from '../services/auth.service';
import type { LoginDto, LoginResponse } from '../types/auth.types';

/**
 * @title 认证控制器
 * @description 提供登录接口，返回 JWT 与主体信息。
 * @keywords-cn 认证控制器, 登录, JWT
 * @keywords-en auth-controller, login, jwt
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return await this.auth.login(dto);
  }
}
