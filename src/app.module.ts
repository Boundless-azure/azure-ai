import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AICoreModule } from './core/ai/ai-core.module';
import { TipModule } from './core/tip/tip.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env?.DB_PORT || '3306') || 3306,
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_DATABASE || 'azure_ai_dev',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
    }),
    AICoreModule.forRoot({
      isGlobal: true,
      database: {
        type: 'mysql',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env?.DB_PORT || '3306') || 3306,
        username: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_DATABASE || 'azure_ai_dev',
        synchronize: false,
      },
      context: {
        maxMessages: 100,
        maxContextAge: 3600000, // 1小时
        cleanupInterval: 300000, // 5分钟
      },
    }),
    TipModule.forRoot({
      // 可选配置：rootDir 默认指向 src/core；includePatterns 默认 ['**/*.tip']
      // rootDir: join(process.cwd(), 'src', 'core'),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
