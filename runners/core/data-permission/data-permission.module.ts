import { DynamicModule, Module } from '@nestjs/common';
import { DataPermissionService } from './services/data-permission.service';
import { DataPermissionRegistryService } from './services/data-permission.registry.service';
import { DataPermissionContextService } from './services/data-permission-context.service';
import { DataPermissionCache } from './cache/data-permission.cache';
import type { DataPermissionModuleOptions } from './types/data-permission.types';
import { DATA_PERMISSION_OPTIONS } from './types/tokens';
import { DataPermissionController } from './controllers/data-permission.controller';

/**
 * @title 数据权限模块
 * @description 提供 DTO 节点装饰器绑定、forRoot 注入与服务层权限执行能力。
 * @keywords-cn 数据权限模块, forRoot注入, DTO节点, 服务层权限
 * @keywords-en data-permission-module, for-root-injection, dto-node, service-permission
 */
@Module({})
export class DataPermissionModule {
  static forRoot(options: DataPermissionModuleOptions): DynamicModule {
    return {
      module: DataPermissionModule,
      global: options.isGlobal ?? false,
      controllers: [DataPermissionController],
      providers: [
        { provide: DATA_PERMISSION_OPTIONS, useValue: options },
        DataPermissionCache,
        DataPermissionRegistryService,
        DataPermissionContextService,
        DataPermissionService,
      ],
      exports: [
        DataPermissionCache,
        DataPermissionRegistryService,
        DataPermissionContextService,
        DataPermissionService,
      ],
    };
  }
}
