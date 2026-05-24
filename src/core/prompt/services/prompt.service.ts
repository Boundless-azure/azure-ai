import { Injectable, Inject } from '@nestjs/common';
import { PromptRenderer } from './prompt.renderer';

/**
 * PromptService
 * 为 Prompt 模板提供高层封装的渲染能力，适合在 IDE 中查看方法说明与示例。
 *
 * 功能概览：
 * - 注册/扩展 helpers（函数渲染的白名单）
 * - 字符串模板渲染（renderString）
 * - 严格 JSON-only 渲染（renderToJson）
 *
 * 示例：
 * const text = promptService.renderString(
 *   'Hello, ${user.name}! Tags: ${join(tags, ",")}',
 *   { user: { name: 'Azure' }, tags: ['a','b'] }
 * );
 * const json = promptService.renderToJson(
 *   '{"user": {"name": "${user.name}"}}',
 *   { user: { name: 'Azure' } }
 * );
 */
@Injectable()
export class PromptService {
  private readonly helpers: Record<string, (...args: any[]) => any> = {};

  constructor(
    private readonly renderer: PromptRenderer,
    @Inject('PROMPT_HELPERS')
    private readonly baseHelpers: Record<string, (...args: any[]) => any> = {},
  ) {
    // 合并初始 helpers
    Object.assign(this.helpers, this.baseHelpers);
  }

  /**
   * 注册自定义 helper 函数（加入白名单），可在表达式中直接调用。
   * @param name Helper 名称（表达式中的调用名）
   * @param fn   Helper 实现（签名不限，按需使用）
   * @example
   * promptService.registerHelper('fullName', (u) => `${u.first} ${u.last}`);
   * // 模板中：${fullName(user)}
   */
  registerHelper(name: string, fn: (...args: any[]) => any): void {
    this.helpers[name] = fn;
  }

  /**
   * 渲染字符串模板（支持 `${expr}` 的表达式语法）。
   * @param template 模板字符串，例如：'Hello, ${user.name}!'
   * @param data     模板渲染数据，表达式中可直接访问其字段
   * @returns 渲染完成的字符串
   * @example
   * promptService.renderString('Hello, ${upper(user.name)}!', { user: { name: 'azure' } });
   */
  renderString(template: string, data: Record<string, any> = {}): string {
    return this.renderer.render(template, data, this.helpers);
  }

  /**
   * 渲染模板并强制输出为合法的 JSON。
   * 若渲染结果无法被 JSON.parse 解析，将抛出错误。
   * @param template JSON 模板字符串，例如：'{"user": {"name": "${user.name}"}}'
   * @param data     模板渲染数据
   * @returns 解析后的 JSON 对象/数组/值
   * @example
   * promptService.renderToJson('{"tags": ${toJson(tags)}}', { tags: ['a', 'b'] });
   */
  renderToJson(template: string, data: Record<string, any> = {}): unknown {
    return this.renderer.renderToJson(template, data, this.helpers);
  }
}
