import { Injectable } from '@nestjs/common';
import { DataPermissionRegistryService } from './data-permission.registry.service';
import {
  DataPermissionError,
  type DataPermissionFailureItem,
} from '../errors/data-permission.error';
import type {
  DataPermissionContext,
  DataPermissionDtoClass,
  DataPermissionNodeRegistration,
} from '../types/data-permission.types';

/**
 * @title 数据权限执行服务
 * @description 新范式核心入口 :: applyTo(DtoClass, payload, ctx) 纯验证不改 payload。
 *
 *              流程:
 *              1. 加载 DTO 上声明的节点 + 全部 global=true 的强制节点
 *              2. 按 ctx.dataPermissions (角色拥有的数据权限分配) 过滤 :: 二者交集生效
 *                 + 通配 (subject='*' 或 action='*') 视为 ctx 拥有该 (subject, action) 节点
 *              3. global 段先跑 :: AND 强制, 任一失败立即抛 DataPermissionError
 *              4. dto 段后跑 :: OR 合并, 任一通过即整体过, 全失败收集所有 errorMsg 抛错
 *              5. 通过 → 返 payload (原样, 不改)
 *
 *              "ctx 没拥有任何 dto 节点" 视为全开 (ctx 在该 subject 上没数据权限授权), 直接返 payload。
 *              global 节点不受这个影响, 永远强制跑。
 *
 * @keywords-cn 数据权限执行, 纯验证, OR 合并, 全局强制, applyTo
 * @keywords-en data-permission-executor, pure-validator, or-merge, global-mandatory, apply-to
 */
@Injectable()
export class DataPermissionService {
  constructor(private readonly registry: DataPermissionRegistryService) {}

  /**
   * @title applyTo - 数据权限校验入口
   * @description 给定 DTO 类 + payload + ctx, 校验通过返 payload, 失败抛 DataPermissionError。
   *              service 层只需调一次, 不再操心权限逻辑。
   * @keyword-en apply-to
   */
  async applyTo<T>(
    dtoClass: DataPermissionDtoClass,
    payload: T,
    ctx: DataPermissionContext,
  ): Promise<T> {
    // 1) global 强制段 :: 全员必跑, AND 累加
    const globalNodes = this.registry.listGlobal();
    if (globalNodes.length > 0) {
      for (const node of globalNodes) {
        const result = await this.runHandler(node, ctx, payload);
        if (result === true) continue;
        // global 强制段任一失败 → 立即抛, 不需要 OR 合并
        const errorMsg =
          typeof result === 'string'
            ? result
            : (node.meta.errorMsg ??
              `[global] ${node.meta.subject}:${node.meta.action} 校验未通过`);
        throw new DataPermissionError([
          {
            subject: node.meta.subject,
            action: node.meta.action,
            errorMsg,
            weight: node.meta.weight,
          },
        ]);
      }
    }

    // 2) dto 局部段 :: 按 ctx 拥有的节点过滤后 OR 合并
    const dtoNodes = this.registry.listByDto(dtoClass);
    if (dtoNodes.length === 0) {
      // 该 DTO 没有声明任何数据权限节点 → 全开
      return payload;
    }

    const applicable = dtoNodes.filter((node) =>
      this.ctxHasNode(ctx, node.meta.subject, node.meta.action),
    );
    if (applicable.length === 0) {
      // ctx 在该 subject 上没拿到任何数据权限授权 → 全开 (默认放行)
      // (注: CASL 那一层管"能不能调", 走到这里说明粗粒度允许, 数据层未配置 = 不收紧)
      return payload;
    }

    // OR 合并 :: 任一通过即整体过
    const failures: DataPermissionFailureItem[] = [];
    for (const node of applicable) {
      const result = await this.runHandler(node, ctx, payload);
      if (result === true) {
        return payload; // 短路
      }
      const errorMsg =
        typeof result === 'string'
          ? result
          : (node.meta.errorMsg ??
            `${node.meta.subject}:${node.meta.action} 校验未通过`);
      failures.push({
        subject: node.meta.subject,
        action: node.meta.action,
        errorMsg,
        weight: node.meta.weight,
      });
    }

    // 全失败 → 收集所有 errorMsg, 让前端/LLM 知道任一通过即可
    throw new DataPermissionError(failures);
  }

  /**
   * 跑单个节点 handler, 异常自动转成 string 错误信息 (handler 不应该抛, 但兜底)
   * @keyword-en run-single-handler
   */
  private async runHandler(
    node: DataPermissionNodeRegistration,
    ctx: DataPermissionContext,
    payload: unknown,
  ): Promise<boolean | string> {
    try {
      return await node.handler({ ctx, payload });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return `节点 ${node.meta.subject}:${node.meta.action} 执行异常: ${msg}`;
    }
  }

  /**
   * 判断 ctx 是否拥有某个 (subject, action) 的数据权限节点
   * 通配规则 :: subject='*' 或 (subject 同 AND action='*') 即视为拥有
   * @keyword-en ctx-has-node
   */
  private ctxHasNode(
    ctx: DataPermissionContext,
    subject: string,
    action: string,
  ): boolean {
    for (const p of ctx.dataPermissions) {
      if (p.subject === '*' && p.action === '*') return true;
      if (p.subject === '*' && p.action === action) return true;
      if (p.subject === subject && p.action === '*') return true;
      if (p.subject === subject && p.action === action) return true;
    }
    return false;
  }
}
