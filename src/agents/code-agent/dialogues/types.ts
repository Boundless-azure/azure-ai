/**
 * @title Code Agent Target Types
 * @description Minimal target contracts kept after removing the old node workflow.
 * @keyword-cn 目标类型, 工作流重构
 * @keyword-en target-kind, workflow-refactor
 */

export type CodeAgentTargetKind = 'app' | 'unit' | 'data-point';

/**
 * @title Code Agent Target Selection
 * @description Runner-backed Solution/App target metadata kept for the next workflow implementation.
 * @keyword-cn 目标选择, Runner目标
 * @keyword-en target-selection, runner-target
 */
export interface CodeAgentTargetSelection {
  /** 本次目标类型 */
  targetKind: CodeAgentTargetKind;
  /** Runner 数据库所在执行节点 ID */
  runnerId: string;
  /** Solution 数据库 ID */
  solutionId: string;
  /** Solution 名称 */
  solutionName: string;
  /** Solution 版本 */
  solutionVersion: string;
  /** Solution 是否已完成 Runner workspace 初始化 */
  solutionInitialized: boolean;
  /** App 数据库 ID */
  appId?: string;
  /** App 名称 */
  appName?: string;
  /** App 版本 */
  appVersion?: string;
  /** App 是否已完成 Runner workspace 初始化 */
  appInitialized?: boolean;
}
