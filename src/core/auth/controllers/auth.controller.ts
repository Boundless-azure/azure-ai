import { Body, Controller, Post, HttpCode, UseGuards } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { CurrentPrincipal } from '../decorators/current-principal.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthService } from '../services/auth.service';
import type {
  ChangePasswordDto,
  JwtPayload,
  LoginDto,
  LoginResponse,
} from '../types/auth.types';

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
  @HttpCode(200)
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return await this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentPrincipal() principal: JwtPayload | undefined,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changePassword(principal?.id || '', dto);
    return { success: true } as const;
  }
}
