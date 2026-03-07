import { Inject, Injectable } from '@nestjs/common';
import { getDtoNodeBindings } from '../decorators/data-permission-node.decorator';
import { DataPermissionCache } from '../cache/data-permission.cache';
import type {
  DataPermissionDtoClass,
  DataPermissionModuleOptions,
} from '../types/data-permission.types';
import { DATA_PERMISSION_OPTIONS } from '../types/tokens';
import { DataPermissionBindingEntity } from '../entities/data-permission-binding.entity';

/**
 * @title 数据权限注册表服务
 * @description 解析 forRoot 配置并建立表到 DTO、DTO 到节点的绑定索引。
 * @keywords-cn 注册表服务, forRoot解析, DTO绑定
 * @keywords-en registry-service, for-root-parse, dto-binding
 */
@Injectable()
export class DataPermissionRegistryService {
  constructor(
    @Inject(DATA_PERMISSION_OPTIONS)
    private readonly options: DataPermissionModuleOptions,
    private readonly cache: DataPermissionCache,
  ) {
    this.rebuild();
  }

  rebuild(): void {
    const tableNames = Object.keys(this.options.tableDtoMap);
    for (const table of tableNames) {
      const dtoClasses = this.options.tableDtoMap[table] ?? [];
      this.cache.setTableDtos(table, dtoClasses);
      for (const dtoClass of dtoClasses) {
        const methodBinding = getDtoNodeBindings(dtoClass);
        const nodeKeys = Object.values(methodBinding).flat();
        this.cache.setDtoNodes(dtoClass, Array.from(new Set(nodeKeys)));
      }
    }
  }

  getRegisteredTables(): string[] {
    return Object.keys(this.options.tableDtoMap);
  }

  hasDtoBinding(table: string, dtoClass: DataPermissionDtoClass): boolean {
    return this.cache.getTableDtos(table).includes(dtoClass);
  }

  getDtoNodes(dtoClass: DataPermissionDtoClass): string[] {
    return this.cache.getDtoNodes(dtoClass);
  }

  getBindingsByTable(table: string): DataPermissionBindingEntity[] {
    const dtoClasses = this.cache.getTableDtos(table);
    return dtoClasses.map((dtoClass) => ({
      table,
      dtoName: dtoClass.name,
      nodeKeys: this.cache.getDtoNodes(dtoClass),
    }));
  }

  getTableDtoHashMap(): Record<string, string[]> {
    return this.cache.getTableDtoHashMap();
  }
}
