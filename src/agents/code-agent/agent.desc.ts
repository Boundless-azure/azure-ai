/**
 * @title Code Agent Description
 * @description 代码智能体描述
 * @keywords-cn 代码智能体, 描述
 * @keywords-en code-agent, description
 */
export default class AgentDesc {
  /**
   * 智能体名称
   */
  name: string = 'code-agent';
  /**
   * 智能体描述
   */
  description: string =
    '开发需求澄清与代码智能体, 用于严肃梳理需求、分析优缺点与风险, 并在确认后推进开发';
  /**
   * 是否支持对话
   */
  supportDialogue: boolean = true;
}
