import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { HookAwareLogger } from './core/observability/services/hook-aware.logger';

declare const module: any;

async function bootstrap() {
  // bufferLogs=true: 捕获启动期 log 等 useLogger 替换后再 flush; 必须在 useLogger 之前
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  // 全局替换 NestJS Logger 为 HookAwareLogger: 所有 service 内 this.logger.xxx 自动 fan-out 到当前 hook 调用上下文的 OTel SpanEvent
  // 非 hook 链路时是 noop (零开销), hook 链路 + debug=true 时进 result.debugLog 给 LLM 自我诊断
  app.useLogger(new HookAwareLogger());

  // 静态资源目录：/static，访问路径为 /static/**
  app.useStaticAssets(join(__dirname, 'static'), { prefix: '/static' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // HttpWsExceptionFilter 通过 CoreMiddlewareModule APP_FILTER 注册
  // 与 ForwardingMiddleware 在同一过滤器池，NestJS 按 @Catch 特异性排序

  await app.listen(process.env.PORT ?? 3000);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (module.hot) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    module.hot.accept();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    module.hot.dispose(() => app.close());
  }
}
void bootstrap();
