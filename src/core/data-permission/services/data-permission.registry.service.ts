import { Injectable } from '@nestjs/common';
import { DataPermissionCache } from '../cache/data-permission.cache';
import {
  listAllDataPermissionNodes,
  listDataPermissionNodesByDto,
  listGlobalDataPermissionNodes,
} from '../decorators/data-permission-node.decorator';
import type {
  DataPermissionDtoClass,
  DataPermissionNodeRegistration,
} from '../types/data-permission.types';

/**
 * @title 数据权限注册表服务
 * @description 内存级 SSOT, 数据来源是 @DataPermissionNode 装饰器全局表。
 *              启动期靠装饰器自然完成注册 (装饰器副作用), 这里只是查询接口。
 *              app/identity 的 PermissionDefinitionService 会在启动期调
 *              listAll() 把所有 data 节点 upsert 到 permission_definitions 表。
 * @keywords-cn 注册表, 装饰器扫描, SSOT, 启动期
 * @keywords-en registry, decorator-scan, ssot, startup
 */
@Injectable()
export class DataPermissionRegistryService {
  // cache 保留是为了兼容旧 controller (debug 用) 的 listTables / listBindings
  // 新数据全部走装饰器表
  constructor(private readonly cache: DataPermissionCache) {}

  /**
   * 列出全部已声明的数据权限节点 (含 global)
   * @keyword-en list-all-nodes
   */
  listAll(): DataPermissionNodeRegistration[] {
    return listAllDataPermissionNodes();
  }

  /**
   * 列出指定 DTO 上声明的数据权限节点 (不含 global, global 由 listGlobal 单独取)
   * @keyword-en list-by-dto
   */
  listByDto(
    dtoClass: DataPermissionDtoClass,
  ): DataPermissionNodeRegistration[] {
    return listDataPermissionNodesByDto(dtoClass);
  }

  /**
   * 列出全部 global=true 的强制节点 :: applyTo 全员必跑
   * @keyword-en list-global
   */
  listGlobal(): DataPermissionNodeRegistration[] {
    return listGlobalDataPermissionNodes();
  }

  /**
   * 列出全部已注册的 (subject, action) 二元组 :: 给前端 / debug 接口用
   * @keyword-en list-subject-actions
   */
  listSubjectActions(): Array<{ subject: string; action: string }> {
    const seen = new Set<string>();
    const result: Array<{ subject: string; action: string }> = [];
    for (const r of listAllDataPermissionNodes()) {
      const key = `${r.meta.subject}::${r.meta.action}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ subject: r.meta.subject, action: r.meta.action });
    }
    return result;
  }

  /**
   * 以 subject 为 key 的 (subject -> actions[]) 映射 :: 给前端 / debug 接口用
   * @keyword-en list-subject-action-map
   */
  getSubjectActionMap(): Record<string, string[]> {
    const map: Record<string, Set<string>> = {};
    for (const r of listAllDataPermissionNodes()) {
      const set = (map[r.meta.subject] ??= new Set());
      set.add(r.meta.action);
    }
    const result: Record<string, string[]> = {};
    for (const k of Object.keys(map)) result[k] = [...map[k]];
    return result;
  }

  /**
   * @deprecated 旧 controller 兼容: 返回当前注册表的 subject 列表
   * @keyword-en deprecated-table-list
   */
  getRegisteredTables(): string[] {
    return Object.keys(this.getSubjectActionMap());
  }

  /**
   * @deprecated 旧 controller 兼容: 等同 getSubjectActionMap
   * @keyword-en deprecated-table-dto-hash-map
   */
  getTableDtoHashMap(): Record<string, string[]> {
    void this.cache;
    return this.getSubjectActionMap();
  }

  /**
   * @deprecated 旧 controller listBindings(table) 兼容
   * @keyword-en deprecated-bindings
   */
  getBindingsByTable(table: string): Array<{
    table: string;
    nodeKeys: string[];
  }> {
    const map = this.getSubjectActionMap();
    return [{ table, nodeKeys: map[table] ?? [] }];
  }
}
