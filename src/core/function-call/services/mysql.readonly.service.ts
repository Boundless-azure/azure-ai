import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  FunctionCallHandle,
  FunctionCallServiceContract,
} from '../types/service.types';
import { MysqlSelectFunctionDescription } from '../descriptions/db/mysql-select';

/**
 * @title MySQL 只读查询服务
 * @desc 执行安全的只读 SELECT 查询，带关键词黑名单与行数上限控制。
 */
@Injectable()
export class MysqlReadonlyService implements FunctionCallServiceContract {
  private static readonly WRITE_KEYWORDS = [
    'insert',
    'update',
    'delete',
    'truncate',
    'alter',
    'drop',
    'create',
    'replace',
    'grant',
    'revoke',
    'lock',
    'unlock',
    'set',
  ];

  // 系统级最大行数上限，避免一次性返回过大数据
  private static readonly MAX_ROWS = 200;

  constructor(private readonly dataSource: DataSource) {}

  /**
   * 执行只读 SELECT 查询
   * - 校验语句以 SELECT 开头（忽略前导空格与注释）
   * - 黑名单关键词拦截：防止写操作
   * - 参数占位符：支持 `?` 与 params 对应绑定
   * - 行数上限：min(limit, MAX_ROWS)
   */
  async select(args: {
    sql: string;
    params?: (string | number | boolean | null)[];
    limit: number;
  }): Promise<Record<string, unknown>[]> {
    // 基本提取与类型收敛
    const sql = (args.sql || '').trim().replace(/;\s*$/u, '');
    const params = Array.isArray(args.params) ? args.params : [];
    const limit = Number.isFinite(args.limit) ? Math.max(1, args.limit) : 1;

    // 运行时参数类型校验（仅允许原始值）
    for (const p of params) {
      const ok =
        p === null ||
        typeof p === 'string' ||
        typeof p === 'number' ||
        typeof p === 'boolean';
      if (!ok) {
        throw new BadRequestException(
          'params 仅允许包含原始值（string/number/boolean/null）',
        );
      }
    }

    // 校验占位符与参数数量的一致性（忽略字符串/反引号中的问号）
    const placeholderCount = countSqlPlaceholders(sql);
    if (params.length !== placeholderCount) {
      throw new BadRequestException(
        `SQL 中的 ? 占位符数量（${placeholderCount}）与传入参数数量（${params.length}）不一致`,
      );
    }

    // 仅允许 SELECT 开头（允许前导括号、注释被忽略的场景，这里采用简化约束）
    const lowered = sql.toLowerCase();
    if (!lowered.startsWith('select')) {
      throw new BadRequestException('仅允许执行以 SELECT 开头的只读查询');
    }

    // 黑名单关键词拦截（粗粒度）：出现写操作相关关键词则拒绝
    for (const kw of MysqlReadonlyService.WRITE_KEYWORDS) {
      if (lowered.includes(`${kw} `) || lowered.includes(` ${kw}`)) {
        throw new BadRequestException(
          `查询包含禁止关键词: ${kw}（仅允许只读 SELECT）`,
        );
      }
    }

    // 统一行数上限
    const maxRows = Math.min(limit, MysqlReadonlyService.MAX_ROWS);
    const loweredWithSpace = ` ${lowered} `; // 便于匹配包含空格的关键字
    let wrappedSql: string;
    if (loweredWithSpace.includes(' limit ')) {
      // 若用户 SQL 已含 LIMIT，则使用子查询包裹方式进行二次收敛
      wrappedSql = `SELECT * FROM (${sql}) AS __t LIMIT ${maxRows}`;
    } else {
      wrappedSql = `${sql} LIMIT ${maxRows}`;
    }

    // 通过 TypeORM 的 query 执行原生查询（仅读）
    // 注意：MySQL 驱动支持 `?` 参数位绑定
    const rows: unknown = await this.dataSource.query(wrappedSql, params);
    // 将结果统一映射为 Record<string, unknown>
    if (!Array.isArray(rows)) {
      return [];
    }
    const normalized: Record<string, unknown>[] = rows.map((r) =>
      typeof r === 'object' && r !== null
        ? { ...(r as Record<string, unknown>) }
        : {},
    );
    return normalized;
  }

  /**
   * 提供标准化的函数句柄：mysql_select
   */
  getHandle(): FunctionCallHandle {
    return {
      name: MysqlSelectFunctionDescription.name,
      description: MysqlSelectFunctionDescription,
      validate: (v: unknown): boolean => {
        if (!v || typeof v !== 'object') return false;
        const o = v as { sql?: unknown; params?: unknown; limit?: unknown };
        const sqlOk = typeof o.sql === 'string' && o.sql.trim().length > 0;
        const limitOk = Number.isFinite(Number(o.limit));
        const paramsOk =
          o.params === undefined ||
          (Array.isArray(o.params) &&
            o.params.every(
              (p) =>
                p === null ||
                typeof p === 'string' ||
                typeof p === 'number' ||
                typeof p === 'boolean',
            ));
        return sqlOk && limitOk && paramsOk;
      },
      execute: async (args: unknown): Promise<unknown> => {
        return this.select(
          args as {
            sql: string;
            params?: (string | number | boolean | null)[];
            limit: number;
          },
        );
      },
    };
  }
}

/**
 * 统计 SQL 中的参数占位符数量：仅统计不在引号（' " `）内的问号。
 * 该方法不解析注释块，假定注释中一般不会包含绑定占位符。
 */
function countSqlPlaceholders(sql: string): number {
  let count = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && !inDouble && !inBacktick) {
      // 处理转义：简单跳过连续两个单引号 '' -> 视为字符内
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle && !inBacktick) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === '`' && !inSingle && !inDouble) {
      inBacktick = !inBacktick;
      continue;
    }
    if (!inSingle && !inDouble && !inBacktick && ch === '?') count++;
  }
  return count;
}
