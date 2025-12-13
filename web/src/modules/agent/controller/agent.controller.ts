/**
 * @title Agent Controller
 * @description Controller for Agent module logic, bridging services and UI.
 * @keywords-cn 代理控制器, 逻辑处理
 * @keywords-en agent-controller, logic-processing
 */

import { agentService } from '../services/agent.service';
import type { ChatMessage, WorkflowStep, QuickItem, GroupListItem } from '../types/agent.types';

export class AgentController {
  /**
   * Get Group History
   * @description Retrieves history for a specific group.
   */
  public async getGroupHistory(groupId: string): Promise<ChatMessage[]> {
    return await agentService.getGroupHistory(groupId);
  }

  /**
   * Get Workflow Steps
   * @description Retrieves current workflow steps.
   */
  public getWorkflowSteps(): WorkflowStep[] {
    return agentService.getWorkflowSteps();
  }

  /**
   * Get Quick Items
   * @description Retrieves items for the quick panel.
   */
  public getQuickItems(): QuickItem[] {
    return agentService.getQuickItems();
  }

  /**
   * Get Group List
   * @description Retrieves list of session groups.
   */
  public async getGroupList(): Promise<GroupListItem[]> {
    return await agentService.getGroupList();
  }

  /**
   * List Checkpoints
   * @description Retrieves checkpoints for a thread.
   */
  public async listCheckpoints(threadId: string, limit = 50) {
    return await agentService.listCheckpoints(threadId, limit);
  }

  /**
   * Get Checkpoint Detail
   * @description Retrieves checkpoint detail.
   */
  public async getCheckpointDetail(threadId: string, checkpointId: string) {
    return await agentService.getCheckpointDetail(threadId, checkpointId);
  }
}

export const agentController = new AgentController();
