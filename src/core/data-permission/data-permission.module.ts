import { DynamicModule, Module } from '@nestjs/common';
import { DataPermissionService } from './services/data-permission.service';
import { DataPermissionRegistryService } from './services/data-permission.registry.service';
import { DataPermissionContextService } from './services/data-permission-context.service';
import { DataPermissionCache } from './cache/data-permission.cache';
import type { DataPermissionModuleOptions } from './types/data-permission.types';
import { DATA_PERMISSION_OPTIONS } from './types/tokens';
import { DataPermissionController } from './controllers/data-permission.controller';

/**
 * @title 数据权限模块 (新范式)
 * @description 不再需要 forRoot 配置 nodes / tableDtoMap, 全部走 @DataPermissionNode 装饰器扫描 (SSOT)。
 *              forRoot 仅保留 isGlobal 参数控制注册作用域, 兼容期 forFeature 也仍可用。
 *              业务方 :: 在 DTO 上挂 @DataPermissionNode 静态方法, service 注入 DataPermissionService 调 applyTo。
 * @keywords-cn 数据权限模块, 装饰器扫描, SSOT
 * @keywords-en data-permission-module, decorator-scan, ssot
 */
@Module({})
export class DataPermissionModule {
  static forRoot(options: DataPermissionModuleOptions = {}): DynamicModule {
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

  /**
   * 模块级注册 (兼容期, 行为同 forRoot 但非 global)
   * @keyword-en for-feature-compat
   */
  static forFeature(): DynamicModule {
    return DataPermissionModule.forRoot({ isGlobal: false });
  }
}
