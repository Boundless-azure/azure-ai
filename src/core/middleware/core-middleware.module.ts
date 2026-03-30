import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainBindingEntity } from '../../app/runner/entities/domain-binding.entity';
import { RunnerEntity } from '../../app/runner/entities/runner.entity';
import { ForwardingMiddleware } from './forwarding.middleware';
import { HttpWsExceptionFilter } from '../common/filters/http-ws-exception.filter';

/**
 * @title 核心中间件模块
 * @description 将 ForwardingMiddleware 和 HttpWsExceptionFilter 均注册为 APP_FILTER。
 *              NestJS 在同一过滤器池中按 @Catch 特异性排序：
 *              @Catch(NotFoundException) ForwardingMiddleware 优先于 @Catch() HttpWsExceptionFilter。
 * @keywords-cn 核心中间件, 404转发, ExceptionFilter, 异常过滤器排序
 * @keywords-en core-middleware, 404-forward, exception-filter, filter-order
 */
@Module({
  imports: [TypeOrmModule.forFeature([DomainBindingEntity, RunnerEntity])],
  providers: [
    ForwardingMiddleware,
    // 先注册 catch-all 兜底，再注册特异性更高的 ForwardingMiddleware
    // NestJS pickFilter 逻辑：有 exceptionMetatypes 的过滤器优先
    { provide: APP_FILTER, useClass: HttpWsExceptionFilter },
    { provide: APP_FILTER, useClass: ForwardingMiddleware },
  ],
})
export class CoreMiddlewareModule {}
