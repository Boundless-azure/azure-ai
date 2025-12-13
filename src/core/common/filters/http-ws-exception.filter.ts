import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

/**
 * @title HTTP/WS 统一异常过滤器
 * @description 根据调用协议分别序列化异常：HTTP 返回 JSON，WS 通过 error 事件发送错误载荷。
 * @keywords-cn 异常过滤器, HTTP错误, WebSocket错误, DTO校验
 * @keywords-en exception-filter, http-error, websocket-error, dto-validation
 */
@Catch()
export class HttpWsExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const type = host.getType();
    if (type === 'ws') {
      this.handleWsException(exception, host);
      return;
    }
    this.handleHttpException(exception, host);
  }

  private handleHttpException(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const request = ctx.getRequest<{ url?: string }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const payload =
        typeof res === 'string' ? { statusCode: status, message: res } : res;
      response.status(status).json(payload as unknown);
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      path: request?.url,
    });
  }

  private handleWsException(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToWs();
    const client = ctx.getClient<{
      emit: (event: string, payload: unknown) => void;
    }>();

    let message: string;
    let code: string | number = 'WS_INTERNAL_ERROR';
    let statusCode: number | undefined;
    let details: unknown;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      code = status;
      statusCode = status;
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const anyRes = res as {
          statusCode?: number;
          code?: string;
          message?: string | string[];
          errors?: unknown;
        };
        if (anyRes.statusCode && !statusCode) {
          statusCode = anyRes.statusCode;
        }
        if (anyRes.code) {
          code = anyRes.code;
        }
        if (anyRes.errors !== undefined) {
          details = anyRes.errors;
        }
        const msg = anyRes.message;
        message = Array.isArray(msg)
          ? msg.join(', ')
          : (msg ?? 'WebSocket error');
      } else {
        message = 'WebSocket error';
      }
    } else if (typeof exception === 'string') {
      message = exception;
    } else if (exception && typeof exception === 'object') {
      const anyErr = exception as { message?: string };
      message = anyErr.message ?? 'WebSocket error';
    } else {
      message = 'WebSocket error';
    }

    const payload: Record<string, unknown> = {
      code,
      message,
    };
    if (statusCode !== undefined) {
      payload.statusCode = statusCode;
    }
    if (details !== undefined) {
      payload.details = details;
    }

    client.emit('ws_error', payload);
  }
}
