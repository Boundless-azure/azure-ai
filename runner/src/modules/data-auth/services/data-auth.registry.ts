import type {
  DataAuthDtoSpec,
  DataAuthNodeHandler,
} from '../types/data-auth.types';

/**
 * @title Data Auth 注册表
 * @description 管理表、DTO、节点处理器之间的映射关系。
 * @keywords-cn 注册表, 表映射, DTO映射, 节点处理器
 * @keywords-en registry, table-map, dto-map, node-handler
 */
export class DataAuthRegistry {
  private tableDtoMap = new Map<string, DataAuthDtoSpec[]>();
  private dtoNodeMap = new Map<string, string[]>();
  private nodeHandlerMap = new Map<string, DataAuthNodeHandler<Record<string, unknown>>>();

  registerTableDtos(table: string, dtos: DataAuthDtoSpec[]): void {
    this.tableDtoMap.set(table, dtos);
  }

  registerDtoNodes(dtoName: string, nodeKeys: string[]): void {
    this.dtoNodeMap.set(dtoName, Array.from(new Set(nodeKeys)));
  }

  registerNodeHandler(
    nodeKey: string,
    handler: DataAuthNodeHandler<Record<string, unknown>>,
  ): void {
    this.nodeHandlerMap.set(nodeKey, handler);
  }

  getDtoNodes(dtoName: string): string[] {
    return this.dtoNodeMap.get(dtoName) ?? [];
  }

  getNodeHandler(nodeKey: string): DataAuthNodeHandler<Record<string, unknown>> | undefined {
    return this.nodeHandlerMap.get(nodeKey);
  }

  hasDtoBinding(table: string, dtoName: string): boolean {
    const specs = this.tableDtoMap.get(table) ?? [];
    return specs.some((item) => item.name === dtoName);
  }
}
