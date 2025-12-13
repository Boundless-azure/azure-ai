/**
 * @title Agent Enums
 * @description Enumerations for the Agent module.
 * @keywords-cn 代理枚举, 角色, 状态
 * @keywords-en agent-enums, role, status
 */

export enum ChatRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}

export enum ToolCallStatus {
  Calling = 'calling',
  Completed = 'completed',
  Failed = 'failed',
}

export enum WorkflowStepStatus {
  Pending = 'pending',
  Active = 'active',
  Completed = 'completed',
  Error = 'error',
}

export enum QuickItemType {
  Resource = 'resource',
  Todo = 'todo',
  Notification = 'notification',
}

export enum WorkflowNodeType {
  Start = 'start',
  Process = 'process',
  Decision = 'decision',
  End = 'end',
}

export enum WorkflowNodeStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Error = 'error',
}

export enum WorkflowEdgeStatus {
  Default = 'default',
  Active = 'active',
  Success = 'success',
  Error = 'error',
}

export enum WorkflowGraphStatus {
  Running = 'Running',
  Pending = 'Pending',
  Completed = 'Completed',
  Error = 'Error',
}
