import { Controller, Get, Query } from '@nestjs/common';
import { DataPermissionRegistryService } from '../services/data-permission.registry.service';

/**
 * @title 数据权限控制器
 * @description 提供数据权限映射查询接口，便于调试表与 DTO 绑定关系。
 * @keywords-cn 数据权限控制器, 映射查询, 调试
 * @keywords-en data-permission-controller, mapping-query, debug
 */
@Controller('core/data-permission')
export class DataPermissionController {
  constructor(private readonly registry: DataPermissionRegistryService) {}

  @Get('tables')
  listTables() {
    return {
      tables: this.registry.getRegisteredTables(),
      tableDtoHashMap: this.registry.getTableDtoHashMap(),
    };
  }

  @Get('bindings')
  listBindings(@Query('table') table?: string) {
    if (!table) {
      return {
        tableDtoHashMap: this.registry.getTableDtoHashMap(),
      };
    }
    return {
      table,
      items: this.registry.getBindingsByTable(table),
    };
  }
}
