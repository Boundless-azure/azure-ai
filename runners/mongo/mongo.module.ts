import { Global, Module, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { MongoModuleOptions } from './types/mongo.types';
import { MongoClientService } from './services/mongo.client';

/**
 * @title Mongo 模块
 * @description 提供 MongoDB 连接与数据库实例的全局注入。
 * @keywords-cn Mongo模块, 连接, 数据库, 全局
 * @keywords-en mongo-module, connection, database, global
 */
@Global()
@Module({})
export class MongoModule {
  static forRoot(options: MongoModuleOptions = {}): DynamicModule {
    return {
      module: MongoModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        MongoClientService,
        {
          provide: 'MONGO_OPTIONS',
          useFactory: (configService: ConfigService) => {
            const conf =
              configService.get<MongoModuleOptions>('appMongo') ?? {};
            return { ...conf, ...options } as MongoModuleOptions;
          },
          inject: [ConfigService],
        },
        {
          provide: 'MONGO_DB',
          useFactory: async (
            clientSvc: MongoClientService,
            configService: ConfigService,
          ) => {
            const conf =
              configService.get<MongoModuleOptions>('appMongo') ?? {};
            const merged: MongoModuleOptions = { ...conf, ...options };
            const enabled = merged.enabled ?? false;
            if (!enabled) return undefined;
            const db = await clientSvc.connect(merged);
            return db;
          },
          inject: [MongoClientService, ConfigService],
        },
      ],
      exports: [MongoClientService, 'MONGO_DB', 'MONGO_OPTIONS'],
    };
  }
}
