/**
 * @title 数据权限绑定实体
 * @description 描述表、DTO 与节点键的绑定关系实体，用于运行时查询展示。
 * @keywords-cn 绑定实体, 表绑定, DTO绑定, 节点绑定
 * @keywords-en binding-entity, table-binding, dto-binding, node-binding
 */
export class DataPermissionBindingEntity {
  table!: string;
  dtoName!: string;
  nodeKeys!: string[];
}
