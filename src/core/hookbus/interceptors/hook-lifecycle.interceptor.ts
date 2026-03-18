import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { HookBusService } from '../services/hook.bus.service';
import {
  HOOK_LIFECYCLE_METADATA,
  type HookLifecycleOptions,
} from '../decorators/hook-lifecycle.decorator';

/**
 * @title Hook 生命周期拦截器
 * @description 在请求完成后触发单次 Hook 事件，统一携带结果或错误。
 * @keywords-cn Hook拦截器, 单次钩子, 错误治理
 * @keywords-en hook-interceptor, single-hook, error-governance
 */
@Injectable()
export class HookLifecycleInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly hookBus: HookBusService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const options = this.reflector.get<HookLifecycleOptions>(
      HOOK_LIFECYCLE_METADATA,
      context.getHandler(),
    );
    if (!options) return next.handle();
    const req = context.switchToHttp().getRequest<{
      body?: unknown;
      query?: unknown;
      params?: unknown;
      user?: { id?: string; type?: string };
      method?: string;
      path?: string;
    }>();
    const method = (req?.method ?? 'GET').toUpperCase();
    const payloadSource =
      options.payloadSource && options.payloadSource !== 'auto'
        ? options.payloadSource
        : method === 'GET'
          ? 'query'
          : 'body';
    const payload =
      payloadSource === 'params'
        ? req?.params
        : payloadSource === 'query'
          ? req?.query
          : req?.body;
    const declaration = {
      description: options.description,
      payloadDto: options.payloadDto,
      middlewares:
        options.middlewares ??
        (options.payloadDto ? ['validate-payload'] : undefined),
      filter: options.filter,
      errorMode: options.errorMode ?? 'capture',
    };
    const meta = {
      principalId: req?.user?.id,
      principalType: req?.user?.type,
      method: req?.method,
      path: req?.path,
      params: req?.params,
      query: req?.query,
    };
    return next.handle().pipe(
      tap((result) => {
        void this.hookBus
          .emit({
            name: options.hook,
            payload: {
              input: payload,
              meta,
              ok: true,
              result,
            },
            filter: options.filter,
            declaration,
          })
          .catch(() => {
            return;
          });
      }),
      catchError((error: unknown) => {
        void this.hookBus
          .emit({
            name: options.hook,
            payload: {
              input: payload,
              meta,
              ok: false,
              error:
                error instanceof Error
                  ? { message: error.message, name: error.name }
                  : { message: String(error) },
            },
            filter: options.filter,
            declaration,
          })
          .catch(() => {
            return;
          });
        return throwError(() => error);
      }),
    );
  }
}
