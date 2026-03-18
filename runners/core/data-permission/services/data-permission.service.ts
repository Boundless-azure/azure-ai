import { Inject, Injectable } from '@nestjs/common';
import { DataPermissionRegistryService } from './data-permission.registry.service';
import type {
  DataPermissionDtoClass,
  DataPermissionModuleOptions,
  DataPermissionResolveResult,
} from '../types/data-permission.types';
import { DATA_PERMISSION_OPTIONS } from '../types/tokens';

/**
 * @title 数据权限执行服务
 * @description 按表名、DTO 与上下文执行绑定的数据权限节点并聚合查询条件。
 * @keywords-cn 数据权限执行, 节点聚合, 服务层使用
 * @keywords-en data-permission-executor, node-aggregate, service-usage
 */
@Injectable()
export class DataPermissionService {
  constructor(
    private readonly registry: DataPermissionRegistryService,
    @Inject(DATA_PERMISSION_OPTIONS)
    private readonly options: DataPermissionModuleOptions,
  ) {}

  async resolve(
    table: string,
    dtoClass: DataPermissionDtoClass,
    context: {
      principalId?: string;
      tenantId?: string;
      roles: string[];
      permissions: string[];
      attributes: Record<string, unknown>;
    },
    payload?: Record<string, unknown>,
  ): Promise<DataPermissionResolveResult> {
    if (!this.registry.hasDtoBinding(table, dtoClass)) {
      return {
        table,
        dtoName: dtoClass.name,
        allow: true,
        where: {},
        matchedNodes: [],
        deniedNodes: [],
      };
    }

    const nodeKeys = this.registry.getDtoNodes(dtoClass);
    const where: Record<string, unknown> = {};
    const matchedNodes: string[] = [];
    const deniedNodes: string[] = [];
    let allow = true;

    for (const nodeKey of nodeKeys) {
      const handler = this.options.nodes[nodeKey];
      if (!handler) {
        continue;
      }
      const result = await handler({ table, dtoClass, context, payload });
      if (result.allow) {
        matchedNodes.push(nodeKey);
        if (result.where) {
          Object.assign(where, result.where);
        }
      } else {
        deniedNodes.push(nodeKey);
        allow = false;
      }
    }

    return {
      table,
      dtoName: dtoClass.name,
      allow,
      where,
      matchedNodes,
      deniedNodes,
    };
  }
}
