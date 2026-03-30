import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';

declare const module: any;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
