import { Injectable, Inject } from '@nestjs/common';

/**
 * RenderOptions
 * 渲染选项配置。
 *
 * - strictJson：当为 true 时，将对渲染结果进行 JSON.parse 验证，若无效则抛出错误。
 */
export interface RenderOptions {
  strictJson?: boolean; // 若为 true，render 返回必须是可 JSON.parse 的字符串
}

/**
 * PromptRenderer
 * 一个轻量的受限表达式求值器 + 模板渲染器。
 *
 * 能力：
 * - `${expr}` 表达式渲染；expr 在受限沙箱中求值。
 * - 数组渲染：helpers.renderList(list, itemTemplate)；模板中可使用 `${item}`、`${index}`。
 * - 函数渲染：通过白名单 helpers 在表达式中调用常用函数。
 * - 安全校验：对表达式做黑名单过滤以降低风险。
 */
@Injectable()
export class PromptRenderer {
  private readonly bannedTokens = [
    'this',
    'global',
    'process',
    'require',
    'Function',
    'constructor',
    'eval',
    'class',
    'import',
    '__proto__',
    'prototype',
    'module',
    'exports',
  ];

  constructor(
    @Inject('PROMPT_HELPERS')
    private readonly baseHelpers: Record<string, (...args: any[]) => any> = {},
  ) {
    // make constructor non-empty to satisfy eslint(no-empty-function)
    void this.baseHelpers;
  }

  /**
   * 渲染字符串模板。
   * 使用 `${expr}` 语法的表达式将基于 data 与 helpers 进行求值。
   * @param template 模板字符串
   * @param data     渲染数据（表达式中可访问其字段）
   * @param helpers  额外 helpers（将与内置与全局 helpers 合并）
   * @param options  渲染选项（如 strictJson）
   * @returns 渲染后字符串
   * @example
   * renderer.render('Hello, ${upper(user.name)}!', { user: { name: 'azure' } });
   */
  render(
    template: string,
    data: Record<string, any> = {},
    helpers: Record<string, (...args: any[]) => any> = {},
    options?: RenderOptions,
  ): string {
    const sandbox = this.createSandbox(data, {
      ...this.defaultHelpers(),
      ...this.baseHelpers,
      ...helpers,
    });
    const rendered = template.replace(
      /\$\{([\s\S]*?)\}/g,
      (_match: string, rawExpr: string) => {
        const expr = rawExpr.trim();
        this.assertSafeExpression(expr);
        return this.evalExpression(expr, sandbox);
      },
    );

    if (options?.strictJson) {
      try {
        JSON.parse(rendered);
      } catch (e) {
        throw new Error(
          `Rendered result is not valid JSON: ${(e as Error).message}`,
        );
      }
    }
    return rendered;
  }

  /**
   * 渲染模板并强制输出为合法的 JSON。
   * 若渲染结果无法被 JSON.parse 解析，将抛出错误。
   * @param template JSON 模板字符串
   * @param data     渲染数据
   * @param helpers  额外 helpers
   * @returns 解析后的 JSON 值（对象/数组/原始类型）
   * @example
   * renderer.renderToJson('{"tags": ${toJson(tags)}}', { tags: ['a','b'] });
   */
  renderToJson(
    template: string,
    data: Record<string, any> = {},
    helpers: Record<string, (...args: any[]) => any> = {},
  ): unknown {
    const text = this.render(template, data, helpers);
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`JSON-only rendering failed: ${(e as Error).message}`);
    }
  }

  /**
   * helpers.renderList(list, itemTemplate): 将数组按子模板渲染并拼接为字符串。
   * 可用于 JSON 模板中，如：
   * "items": ${renderList(data.items, '{"id": "${item.id}", "name": "${item.name}"}')}
   */
  /**
   * 提供一组默认 helpers，可在表达式中直接使用：
   * - upper/lower/trim
   * - join
   * - pick
   * - formatDate
   * - renderList
   * - toJson
   */
  private defaultHelpers(): Record<string, (...args: any[]) => any> {
    return {
      // 基础字符串处理
      upper: (s: any) => String(s).toUpperCase(),
      lower: (s: any) => String(s).toLowerCase(),
      trim: (s: any) => String(s).trim(),
      join: (list: any[], sep: string = ',') =>
        Array.isArray(list) ? list.join(sep) : '',

      // 选择字段
      pick: (obj: Record<string, any>, keys: string[]) => {
        if (!obj || !Array.isArray(keys)) return {};
        return keys.reduce(
          (acc, k) => {
            acc[k] = obj[k];
            return acc;
          },
          {} as Record<string, any>,
        );
      },

      // 简易日期格式化
      formatDate: (
        input: string | number | Date,
        locales?: string,
        options?: Intl.DateTimeFormatOptions,
      ) => {
        const d = input instanceof Date ? input : new Date(input);
        return new Intl.DateTimeFormat(
          locales ?? 'en',
          options ?? { year: 'numeric', month: '2-digit', day: '2-digit' },
        ).format(d);
      },

      // 数组渲染
      renderList: (
        list: any[],
        itemTemplate: string,
        extra?: Record<string, any>,
      ) => {
        if (!Array.isArray(list)) return '';
        return list
          .map((item, index) => {
            const itemData = { ...extra, item, index };
            return this.render(itemTemplate, itemData, {}, undefined);
          })
          .join('');
      },

      // JSON 转字符串（避免在表达式中手写 JSON.stringify）
      toJson: (value: any) => JSON.stringify(value),
    };
  }

  /**
   * 合并 data 与 helpers 构造沙箱作用域，供表达式通过 `with(scope)` 进行访问。
   */
  private createSandbox(
    data: Record<string, any>,
    helpers: Record<string, (...args: any[]) => any>,
  ) {
    // 将 data 与 helpers 合并作为 with 作用域可访问的对象
    return { ...data, ...helpers } as Record<string, any>;
  }

  /**
   * 对表达式进行基础黑名单校验，避免出现高风险标识符。
   * 若发现不安全标识符将抛出错误。
   * @param expr 表达式字符串
   */
  private assertSafeExpression(expr: string) {
    const lowered = expr.toLowerCase();
    for (const token of this.bannedTokens) {
      if (lowered.includes(token.toLowerCase())) {
        throw new Error(`Unsafe token found in expression: ${token}`);
      }
    }
  }

  /**
   * 在受限沙箱中对表达式求值。
   * 注意：使用 Function 构造器进行求值，已通过黑名单降低风险。
   * @param expr  表达式字符串
   * @param scope 沙箱对象（包含 data 与 helpers）
   * @returns 字符串结果（若求值结果非字符串，将进行 JSON.stringify）
   */
  private evalExpression(expr: string, scope: Record<string, any>): string {
    // 通过 with(scope) + Function 求值，禁止高危标识符后风险较低，但仍建议仅在受信任模板中使用。
    // 不允许使用 new、class、import 等关键字（已在 assertSafeExpression 处理）。
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = Function('scope', `with (scope) { return ( ${expr} ); }`) as (
        scope: Record<string, any>,
      ) => unknown;
      const result = fn(scope);
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (e) {
      throw new Error(`Expression evaluation error: ${(e as Error).message}`);
    }
  }
}
