import type {
  DataPermissionDtoClass,
  DataPermissionNodeHandler,
  DataPermissionNodeMeta,
  DataPermissionNodeRegistration,
} from '../types/data-permission.types';

/**
 * 全局节点注册表 :: DTO 类 → 该 DTO 上所有数据权限节点
 * 同时维护一个全局列表方便 Registry 启动期一次性扫描
 * @keyword-en global-node-registry
 */
const dtoToNodes = new Map<
  DataPermissionDtoClass,
  DataPermissionNodeRegistration[]
>();
const allRegistrations: DataPermissionNodeRegistration[] = [];

/**
 * @title 数据权限节点装饰器 (新范式)
 * @description 标注在 DTO 类的**静态方法**上, 该静态方法本身就是 handler。
 *              装饰器声明 (subject, action, weight, global?, errorMsg?), 启动期 Registry 扫描登记并同步到 PermissionDefinition。
 *
 *              handler 签名: ({ctx, payload}) => boolean | string | Promise<...>
 *              - true   :: 通过
 *              - false  :: 失败 (用装饰器声明的 errorMsg)
 *              - string :: 失败 (动态 errorMsg, 覆盖装饰器声明值)
 *
 * @example
 * export class QueryTodoDto {
 *   foruser?: string;
 *
 *   @DataPermissionNode({
 *     subject: 'todo',
 *     action: 'read-myself',
 *     weight: 30,
 *     errorMsg: 'foruser 必须等于当前登录用户'
 *   })
 *   static readMyself({ ctx, payload }: NodeArgs<QueryTodoDto>) {
 *     return !payload.foruser || payload.foruser === ctx.principalId;
 *   }
 * }
 *
 * @keywords-cn 数据权限装饰器, 静态方法, SSOT, 启动期同步
 * @keywords-en data-permission-decorator, static-method, ssot, startup-sync
 */
export function DataPermissionNode(meta: DataPermissionNodeMeta) {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    // 必须是静态方法 :: target 直接是类构造器 (typeof target === 'function')
    // 实例方法时 target 是 prototype, descriptor.value 还是函数, 但语义上推荐静态
    const dtoClass =
      typeof target === 'function'
        ? (target as DataPermissionDtoClass)
        : ((target.constructor as DataPermissionDtoClass) ??
          (target as DataPermissionDtoClass));

    const handler = descriptor.value as DataPermissionNodeHandler;
    if (typeof handler !== 'function') {
      throw new Error(
        `@DataPermissionNode 必须挂在方法上 (${dtoClass?.name}.${String(propertyKey)})`,
      );
    }

    const registration: DataPermissionNodeRegistration = {
      meta: {
        subject: meta.subject,
        action: meta.action,
        weight: meta.weight ?? 0,
        global: meta.global ?? false,
        errorMsg: meta.errorMsg,
      },
      handler,
      source: {
        dtoClassName: dtoClass?.name ?? 'UnknownDto',
        methodName: String(propertyKey),
      },
    };

    const existing = dtoToNodes.get(dtoClass) ?? [];
    existing.push(registration);
    dtoToNodes.set(dtoClass, existing);
    allRegistrations.push(registration);
  };
}

/**
 * @title 读取 DTO 上声明的所有数据权限节点
 * @description 给 DataPermissionService.applyTo 用 — DTO 关联的节点元数据 + handler。
 * @keyword-en list-dto-nodes
 */
export function listDataPermissionNodesByDto(
  dtoClass: DataPermissionDtoClass,
): DataPermissionNodeRegistration[] {
  return dtoToNodes.get(dtoClass) ?? [];
}

/**
 * @title 列出全部已声明的数据权限节点
 * @description 给 Registry 启动期同步到 PermissionDefinition 表用。
 * @keyword-en list-all-nodes
 */
export function listAllDataPermissionNodes(): DataPermissionNodeRegistration[] {
  return [...allRegistrations];
}

/**
 * @title 列出全部 global=true 的强制节点
 * @description 给 applyTo 用 — 不论 ctx 是否拥有, 全员必跑。
 * @keyword-en list-global-nodes
 */
export function listGlobalDataPermissionNodes(): DataPermissionNodeRegistration[] {
  return allRegistrations.filter((r) => r.meta.global === true);
}

/**
 * @deprecated 旧装饰器 :: 仅为兼容期保留 (现存 todo DTO 装饰器调用), 新代码请用 @DataPermissionNode。
 *             启动期不再产生有效节点 (仅记录, 不 dispatch handler)。
 * @keyword-en bind-data-permission-node-deprecated
 */
export function BindDataPermissionNode(_nodeKey: string): MethodDecorator {
  return () => {
    // no-op :: 兼容旧装饰器, 防止现存代码报错。新逻辑通过 @DataPermissionNode 走。
  };
}

/**
 * @deprecated 兼容期 stub :: 旧 API 返回 {} 即可, 新逻辑走 listDataPermissionNodesByDto。
 * @keyword-en get-dto-node-bindings-deprecated
 */
export function getDtoNodeBindings(
  _dtoClass: DataPermissionDtoClass,
): Record<string, string[]> {
  return {};
}
