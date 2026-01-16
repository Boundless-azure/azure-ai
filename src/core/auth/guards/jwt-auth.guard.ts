import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * @title JWT 守卫
 * @description 基于 Passport 的 JWT 校验，注入 req.user。
 * @keywords-cn JWT守卫, 鉴权, Passport
 * @keywords-en jwt-guard, auth, passport
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | import('rxjs').Observable<boolean> {
    const isPublic = this.reflector.get<boolean>(
      IS_PUBLIC_KEY,
      context.getHandler(),
    );
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
