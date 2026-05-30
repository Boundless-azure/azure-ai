/**
 * @title HookComponent 装饰器
 * @description 标记一个类属性为 SaaS 侧 Hook 组件声明。
 *              属性值必须是 JS 字符串（ESM 模块代码），导出 render(container, payload, ctx) 函数。
 *              ctx 是前端注入的能力对象（见 web hook-component-ctx）：组件经 ctx.callHook(hookName, payload)
 *              访问数据（SaaS 自动路由 + 注入鉴权，组件不碰 URL/token），ctx.navigate 跳转右侧面板，
 *              ctx.refresh 重拉；ctx 全异步 + 可序列化，为未来 iframe 沙箱预留接缝。
 *              container 是前端为组件创建的 **Shadow DOM root**（open 模式）：宿主页面的
 *              Tailwind / 全局样式不会穿透进来，组件内的样式也不会泄漏出去；因此组件可自由
 *              使用 <style> 标签或 class，无需再靠内联 style 规避污染。仅继承属性（font/color）
 *              跨 shadow 边界。导航跳转仍通过 window.dispatchEvent('hookComponent:navigate') 派发。
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
 *     readonly todoCard = `export async function render(el, p, ctx) {
 *       const todo = await ctx.callHook('saas.app.todo.get', { id: p.todoId });
 *       el.textContent = todo.title;
 *     }`;
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
