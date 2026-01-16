import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../types/auth.types';

/**
 * @title 当前主体装饰器
 * @description 读取 req.user 注入当前主体信息。
 * @keywords-cn 当前主体, 装饰器, req.user
 * @keywords-en current-principal, decorator, req.user
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload | undefined => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    return req.user;
  },
);
