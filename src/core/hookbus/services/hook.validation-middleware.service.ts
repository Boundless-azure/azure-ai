import { Injectable, OnModuleInit } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { HookInvokerService } from './hook.invoker.service';
import { HookResultStatus } from '../enums/hook.enums';
import type { HookContext, HookResult } from '../types/hook.types';

/**
 * @title Hook 载荷校验中间件
 * @description 按 Hook 声明中的 payloadDto 对 payload 执行 class-validator 校验。
 * @keywords-cn Hook中间件, 载荷校验, class-validator
 * @keywords-en hook-middleware, payload-validation, class-validator
 */
@Injectable()
export class HookValidationMiddlewareService implements OnModuleInit {
  constructor(private readonly invoker: HookInvokerService) {}

  onModuleInit(): void {
    this.invoker.useNamed('validate-payload', this.getMiddleware());
  }

  private getMiddleware<T, R>() {
    return async (
      ctx: HookContext<T>,
      next: () => Promise<HookResult<R>>,
    ): Promise<HookResult<R>> => {
      const dtoClass = ctx.event.declaration?.payloadDto;
      if (!dtoClass) return await next();
      const raw = (() => {
        const payload = ctx.event.payload as unknown;
        if (payload && typeof payload === 'object' && 'input' in payload) {
          return (payload as { input?: unknown }).input;
        }
        return payload;
      })();
      const instance = plainToInstance(dtoClass, raw);
      const issues = validateSync(instance, {
        whitelist: true,
        forbidNonWhitelisted: false,
      });
      if (issues.length === 0) return await next();
      return {
        status: HookResultStatus.Error,
        error: issues
          .map((item) => Object.values(item.constraints ?? {}).join(','))
          .filter((item) => item)
          .join('; '),
      } as HookResult<R>;
    };
  }
}
