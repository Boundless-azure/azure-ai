import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 静态资源目录：/static，访问路径为 /static/**
  app.useStaticAssets(join(process.cwd(), 'static'), { prefix: '/static' });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
