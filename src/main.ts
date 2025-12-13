import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { HttpWsExceptionFilter } from './core/common/filters/http-ws-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 静态资源目录：/static，访问路径为 /static/**
  app.useStaticAssets(join(process.cwd(), 'static'), { prefix: '/static' });

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

  app.useGlobalFilters(new HttpWsExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
