/**
 * @title AgentRuntime 轻量实体
 * @description 非持久化，仅用于在内存中记录已加载 Agent 的信息快照。
 * @keywords-cn 实体, 轻量, 快照
 * @keywords-en entity, lightweight, snapshot
 */
export class AgentRuntimeSnapshot {
  dir!: string;
  name?: string;
  supportDialogue?: boolean;
  toolsCount?: number;
}
