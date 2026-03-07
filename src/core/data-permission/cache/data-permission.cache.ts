import { Injectable } from '@nestjs/common';
import type { DataPermissionDtoClass } from '../types/data-permission.types';

/**
 * @title 数据权限缓存
 * @description 缓存表与 DTO 的映射及 DTO 节点绑定信息。
 * @keywords-cn 缓存, 表映射, DTO映射, 节点绑定
 * @keywords-en cache, table-map, dto-map, node-binding
 */
@Injectable()
export class DataPermissionCache {
  private tableDtoMap = new Map<string, DataPermissionDtoClass[]>();
  private dtoNodeMap = new Map<DataPermissionDtoClass, string[]>();

  setTableDtos(table: string, dtoClasses: DataPermissionDtoClass[]): void {
    this.tableDtoMap.set(table, dtoClasses);
  }

  getTableDtos(table: string): DataPermissionDtoClass[] {
    return this.tableDtoMap.get(table) ?? [];
  }

  getTableDtoHashMap(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    this.tableDtoMap.forEach((dtoClasses, table) => {
      result[table] = dtoClasses.map((dtoClass) => dtoClass.name);
    });
    return result;
  }

  setDtoNodes(dtoClass: DataPermissionDtoClass, nodeKeys: string[]): void {
    this.dtoNodeMap.set(dtoClass, nodeKeys);
  }

  getDtoNodes(dtoClass: DataPermissionDtoClass): string[] {
    return this.dtoNodeMap.get(dtoClass) ?? [];
  }
}
