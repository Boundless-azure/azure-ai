import type { DataPermissionDtoClass } from '../types/data-permission.types';

const dtoNodeBindingMap = new Map<
  DataPermissionDtoClass,
  Record<string, string[]>
>();

/**
 * @title 数据权限节点装饰器
 * @description 在 DTO 类方法上绑定数据权限节点键。
 * @keywords-cn 装饰器, DTO方法绑定, 节点键
 * @keywords-en decorator, dto-method-binding, node-key
 */
export function BindDataPermissionNode(nodeKey: string) {
  return (
    target: object,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor,
  ) => {
    const ctor = target.constructor as DataPermissionDtoClass;
    const methodName = propertyKey.toString();
    const exists = dtoNodeBindingMap.get(ctor) ?? {};
    const methodNodes = exists[methodName] ?? [];
    if (!methodNodes.includes(nodeKey)) {
      methodNodes.push(nodeKey);
    }
    exists[methodName] = methodNodes;
    dtoNodeBindingMap.set(ctor, exists);
  };
}

/**
 * @title 读取 DTO 节点绑定
 * @description 读取某个 DTO 类上所有方法绑定的数据权限节点。
 * @keywords-cn 读取绑定, DTO节点, 方法映射
 * @keywords-en read-binding, dto-node, method-map
 */
export function getDtoNodeBindings(
  dtoClass: DataPermissionDtoClass,
): Record<string, string[]> {
  return dtoNodeBindingMap.get(dtoClass) ?? {};
}
