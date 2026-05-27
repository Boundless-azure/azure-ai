/**
 * @title HookComponent 装饰器
 * @description 标记一个类属性为 SaaS 侧 Hook 组件声明。
 *              属性值必须是 JS 字符串（ESM 模块代码），导出 render(container, payload) 函数。
 *              HookComponentExplorerService 在启动时扫描所有 Provider，
 *              将被标记的属性值注册到 HookComponentRegistryService，
 *              同时在 HookBus 注册同名 hook（isComponent=true, denyLlm=true），
 *              让 LLM 可通过 search/getInfo 发现组件，但不能直接 call_hook 调用。
 *
 * 使用示例：
 *   @Injectable()
 *   export class MyComponents {
 *     @HookComponent('saas.app.todo.card', {
 *       description: '渲染待办卡片',
 *       tags: ['todo', 'component'],
 *       payloadSchema: z.object({ todoId: z.string() }),
 *     })
 *     readonly todoCard = `export function render(el, p) { el.textContent = p.title; }`;
 *   }
 *
 * @keywords-cn hook组件装饰器, SaaS组件声明, 预定义组件
 * @keywords-en hook-component-decorator, saas-component-declaration, predefined-component
 */

export const HOOK_COMPONENT_METADATA = 'hook_component_metadata';

/**
 * Hook 组件装饰器的可选元数据。
 * @keyword-en hook-component-meta
 */
export interface HookComponentMeta {
  description?: string;
  tags?: string[];
  /** LLM 调用 fence 时传入的 payload schema (zod)，会暴露给 getInfo 的 JSON Schema */
  payloadSchema?: import('zod').ZodTypeAny;
}

/**
 * 标记类属性为 Hook 组件，hookName 作为查找键，meta 提供描述/标签/schema 供 LLM 发现。
 * @param hookName hook 地址，如 saas.app.todo.card
 * @param meta 可选元数据：description / tags / payloadSchema
 * @keyword-en hook-component-property-decorator
 */
export function HookComponent(
  hookName: string,
  meta?: HookComponentMeta,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existing: Array<{
      hookName: string;
      propertyKey: string | symbol;
      meta?: HookComponentMeta;
    }> = Reflect.getMetadata(HOOK_COMPONENT_METADATA, target.constructor) ?? [];
    existing.push({ hookName, propertyKey, meta });
    Reflect.defineMetadata(
      HOOK_COMPONENT_METADATA,
      existing,
      target.constructor,
    );
  };
}
