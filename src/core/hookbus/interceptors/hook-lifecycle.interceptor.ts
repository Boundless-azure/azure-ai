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
 * @description 在请求完成后触发单次 Hook 事件, principalId / token 写进 event.context, 业务结果写进 payload。
 * @keywords-cn Hook拦截器, 单次钩子, 错误治理, 上下文注入
 * @keywords-en hook-interceptor, single-hook, error-governance, context-injection
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
      headers?: Record<string, string | undefined>;
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
      middlewares: options.middlewares,
      filter: options.filter,
      errorMode: options.errorMode ?? 'capture',
    };
    const token = this.extractToken(req?.headers);
    const invocationContext = {
      token,
      principalId: req?.user?.id,
      principalType: req?.user?.type,
      source: 'http' as const,
    };
    const reqMeta = {
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
              meta: reqMeta,
              ok: true,
              result,
            },
            context: invocationContext,
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
              meta: reqMeta,
              ok: false,
              error:
                error instanceof Error
                  ? { message: error.message, name: error.name }
                  : { message: String(error) },
            },
            context: invocationContext,
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

  private extractToken(
    headers?: Record<string, string | undefined>,
  ): string | undefined {
    if (!headers) return undefined;
    const auth = headers['authorization'] ?? headers['Authorization'];
    if (!auth) return undefined;
    const trimmed = String(auth).trim();
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      return trimmed.slice(7).trim();
    }
    return trimmed;
  }
}
