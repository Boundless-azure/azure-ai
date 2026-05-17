import { Injectable, Logger } from '@nestjs/common';
import { AiSessionDataService } from './ai-session-data.service';
import type { AgentEntity } from '@/app/agent/entities/agent.entity';

/**
 * 单本手册的 seed 描述 :: 注入到 session_data 的 handbook.* 槽位
 *  - 真正章节正文仍在 knowledge 库, value 只塞 bookId + name + hint 作为指针
 *  - getChapter 取章节走 saas.app.knowledge.getChapter, 按需读
 * @keyword-en handbook-seed-spec
 */
interface HandbookSeed {
  /** session_data 的 key (会自动归入 category=handbook) */
  key: string;
  /** 关联的知识库 bookId */
  bookId: string;
  /** 知识库书名 */
  bookName: string;
  /** session_data 的 title (LLM 在 list 一眼看见的描述) */
  title: string;
}

/** azure-ai 默认 agent 必读手册 :: 任何 agent 都要 seed 这一份 */
const DEFAULT_HANDBOOK: HandbookSeed = {
  key: 'handbook.saas_system_hook',
  bookId: 'local_saas_system_hook_skill',
  bookName: 'Saas 系统hook技能手册',
  title:
    'SaaS 系统 Hook 技能手册 :: identity / storage / solution / todo / runner 查询. bookId=local_saas_system_hook_skill, 调 saas.app.knowledge.getToc 拿目录后 getChapter 取章节',
};

/** proactiveChatEnabled 时额外 seed 的手册 :: 主动对话场景必读 */
const PROACTIVE_HANDBOOK: HandbookSeed = {
  key: 'handbook.conversation_hook',
  bookId: 'local_conversation_hook_skill',
  bookName: '对话 Hook 技能手册',
  title:
    '对话 Hook 技能手册 :: 主动对话发消息必读, 含 saas.app.conversation.sendMsg payload + 历史检索 smart 三段式. bookId=local_conversation_hook_skill, getToc + getChapter 取章节',
};

/**
 * @title 会话手册 seed 服务
 * @description Agent 首次在某 session 发言前, 把该 agent 需要的必读手册种进 session_data 的 handbook.* 槽位.
 *              替代原先 im-message.service.ts 里硬编码 ensureKnowledgeBookSessionData 的两次调用.
 *              ownerPrincipalId 强制设为当前 agent 的 principal, 保证 list 渲染时 handbook 段
 *              **只**对该 agent 可见 (群聊多 agent 隔离).
 *              每个 key 内部短路 (已存在则跳过), 多轮调用不污染。
 * @keywords-cn 手册种入, 必读, agent身份, 群聊隔离, 短路
 * @keywords-en handbook-seed, must-read, agent-identity, group-isolated, short-circuit
 */
@Injectable()
export class SessionHandbookSeederService {
  private readonly logger = new Logger(SessionHandbookSeederService.name);

  constructor(private readonly sessionData: AiSessionDataService) {}

  /**
   * 根据 agent 配置 seed 必读手册集合
   *  - 默认手册 :: 所有 agent 都种
   *  - 主动对话手册 :: agent.proactiveChatEnabled !== false 才种
   * @keyword-en seed-for-agent
   */
  async ensureForAgent(
    sessionId: string,
    agent: AgentEntity,
    agentPrincipalId: string,
  ): Promise<void> {
    const handbooks: HandbookSeed[] = [DEFAULT_HANDBOOK];
    if (agent.proactiveChatEnabled !== false) {
      handbooks.push(PROACTIVE_HANDBOOK);
    }

    for (const hb of handbooks) {
      await this.ensureOne(sessionId, hb, agentPrincipalId);
    }
  }

  /**
   * 单本手册 seed :: 已存在则短路, 任意失败仅 warn, 不抛 (手册引导是软提示, 缺失不致命)
   * @keyword-en ensure-one-handbook short-circuit
   */
  private async ensureOne(
    sessionId: string,
    hb: HandbookSeed,
    ownerPrincipalId: string,
  ): Promise<void> {
    try {
      const existing = await this.sessionData.get(sessionId, hb.key);
      // 已存在且 owner 正确 → 短路;
      // owner 不匹配 (理论上不会, 但兜底) → 覆盖
      if (existing && existing.ownerPrincipalId === ownerPrincipalId) {
        return;
      }
      await this.sessionData.save(
        sessionId,
        hb.key,
        {
          bookId: hb.bookId,
          name: hb.bookName,
          hint:
            '通过 saas.app.knowledge.getToc({ bookIds: ["' +
            hb.bookId +
            '"] }) 拿目录, 再 saas.app.knowledge.getChapter 取章节; 不要凭 hook 名或字段名猜。',
        },
        hb.title,
        ownerPrincipalId,
      );
      this.logger.debug(
        `[handbook-seed] seeded key=${hb.key} session=${sessionId} owner=${ownerPrincipalId}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `[handbook-seed] failed key=${hb.key} session=${sessionId}: ${msg}`,
      );
    }
  }
}
