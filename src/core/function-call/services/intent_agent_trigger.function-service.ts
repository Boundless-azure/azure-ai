import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { tool } from 'langchain';
import { z } from 'zod';
import type { FunctionCallServiceContract } from '../types/service.types';
import { IntentAgentTriggerFunctionDescription } from '../descriptions/intent/agent-trigger';
import { AgentEntity } from '@/app/agent/entities/agent.entity';
import { AgentExecutionEntity } from '@/app/agent/entities/agent-execution.entity';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';
import { AIModelService } from '@core/ai/services/ai-model.service';
import { AIProvider } from '@core/ai/types';
import { OpenAIEmbeddings } from '@langchain/openai';

/**
 * @title 意图分析触发服务（Function Call）
 * @desc 根据会话最近消息与 Agent 信息进行匹配，判断是否触发某个 Agent；可选在触发时创建执行记录以开始 Agent 对话。
 * @keywords-cn 意图分析, 触发Agent, 会话, 执行记录, 函数调用
 * @keywords-en intent-analysis, trigger-agent, session, execution-record, function-call
 */
@Injectable()
export class IntentAgentTriggerFunctionService implements FunctionCallServiceContract {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @InjectRepository(AgentExecutionEntity)
    private readonly execRepo: Repository<AgentExecutionEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly msgRepo: Repository<ChatMessageEntity>,
    @InjectRepository(ChatSessionEntity)
    private readonly sessionRepo: Repository<ChatSessionEntity>,
    private readonly aiModelService: AIModelService,
  ) {}

  private async getLastUserMessage(sessionId: string): Promise<string | null> {
    const row = await this.msgRepo
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: sessionId })
      .andWhere('m.is_delete = 0')
      .andWhere('m.role = :role', { role: 'user' })
      .orderBy('m.created_at', 'DESC')
      .getOne();
    return row?.content ?? null;
  }

  private async resolveSessionIdFromThread(
    threadId?: string,
  ): Promise<string | undefined> {
    if (!threadId || threadId.trim().length === 0) return undefined;
    const bySession = await this.sessionRepo.findOne({
      where: { sessionId: threadId, active: true, isDelete: false },
    });
    if (bySession) return bySession.sessionId;
    const byGroup = await this.sessionRepo.find({
      where: { conversationGroupId: threadId, active: true, isDelete: false },
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    return byGroup.length ? byGroup[0].sessionId : undefined;
  }

  private tokenize(text: string): string[] {
    const norm = text.toLowerCase();
    const zh = norm
      .replace(/[\p{P}\p{S}]+/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
    return zh;
  }

  private scoreAgent(agent: AgentEntity, msgKeywords: Set<string>): number {
    const agentTokens = new Set<string>();
    const pushTokens = (text: string | null | undefined) => {
      if (!text) return;
      const arr = this.tokenize(text);
      for (const a of arr) agentTokens.add(a);
    };
    const pushArray = (arr: string[] | null | undefined) => {
      if (!arr) return;
      for (const k of arr) {
        const s = String(k).trim().toLowerCase();
        if (s) agentTokens.add(s);
      }
    };
    pushTokens(agent.nickname);
    pushTokens(agent.purpose);
    pushTokens(agent.codeDir);
    pushArray((agent as unknown as { keywords?: string[] }).keywords);

    let score = 0;
    for (const kw of msgKeywords) {
      if (agentTokens.has(kw))
        score += 2; // 关键词精确命中加权
      else {
        // 轻量子串匹配作为退路
        for (const t of agentTokens) {
          if (t && t.includes(kw)) {
            score += 1;
            break;
          }
        }
      }
    }
    return score;
  }

  private async pickOpenAIKey(): Promise<string | undefined> {
    const models = await this.aiModelService.getEnabledModels();
    for (const m of models) {
      if (
        m.provider === AIProvider.OPENAI &&
        typeof m.apiKey === 'string' &&
        m.apiKey
      ) {
        return m.apiKey;
      }
    }
    return undefined;
  }

  private async embedKeywordsToVec(
    keywords: string[],
  ): Promise<number[] | undefined> {
    const apiKey = await this.pickOpenAIKey();
    if (!apiKey) return undefined;
    const cleaned = keywords
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean);
    if (cleaned.length === 0) return undefined;
    const text = cleaned.join(', ');
    const emb = new OpenAIEmbeddings({
      apiKey,
      model: 'text-embedding-3-small',
    });
    try {
      const vec = await emb.embedQuery(text);
      return Array.isArray(vec) && vec.length > 0 ? vec : undefined;
    } catch {
      return undefined;
    }
  }

  private async vectorSearch(
    vec: number[],
    topK: number,
  ): Promise<Array<{ id: string; score: number }>> {
    const literal = `[${vec.map((v) => (Number.isFinite(v) ? Number(v) : 0)).join(',')}]`;
    const rows: Array<{ id: string; distance: number }> =
      await this.agentRepo.manager.query(
        `SELECT id, embedding <-> '${literal}'::vector AS distance
       FROM agents
       WHERE active = true AND is_delete = false AND embedding IS NOT NULL
       ORDER BY embedding <-> '${literal}'::vector ASC
       LIMIT $1`,
        [topK],
      );
    return rows.map((r) => {
      const d =
        typeof r.distance === 'number' ? r.distance : Number(r.distance);
      const score = 1 / (1 + (Number.isFinite(d) ? d : 1));
      return { id: r.id, score };
    });
  }

  private async hasVectorAgents(): Promise<boolean> {
    const one = await this.agentRepo.manager.query(
      `SELECT 1 FROM agents WHERE active = true AND is_delete = false AND embedding IS NOT NULL LIMIT 1`,
    );
    return Array.isArray(one) && one.length > 0;
  }

  private async analyzeAndMaybeStart(input: {
    sessionId?: string;
    message?: string;
    keywords: string[];
    threshold?: number;
    topK?: number;
    requireStart?: boolean;
  }): Promise<Record<string, unknown>> {
    const { sessionId, message, keywords, topK, threshold, requireStart } =
      input;
    const k = typeof topK === 'number' && topK > 0 ? topK : 1;
    const kwList = Array.isArray(keywords)
      ? keywords.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
      : [];
    if (!kwList.length) {
      return { triggered: false, reason: 'no-keywords', candidates: [] };
    }

    const useVector = await this.hasVectorAgents();
    const th =
      typeof threshold === 'number' && threshold >= 0
        ? threshold
        : useVector
          ? 0.35
          : 1;

    let picked: { agent: AgentEntity; score: number } | undefined;
    let candidates: Array<{ id: string; score: number }> = [];

    if (useVector) {
      const vec = await this.embedKeywordsToVec(kwList);
      if (vec && vec.length) {
        const hits = await this.vectorSearch(vec, k);
        candidates = hits;
        if (hits.length) {
          const ids = hits.map((h) => h.id);
          const found = await this.agentRepo.find({
            where: { id: In(ids), isDelete: false, active: true },
          });
          const byId = new Map(found.map((a) => [a.id, a] as const));
          const top = hits[0];
          const topAgent = byId.get(top.id);
          if (topAgent) picked = { agent: topAgent, score: top.score };
        }
      }
    }

    if (!picked) {
      const msgKeywords = new Set<string>(kwList);
      const agents = await this.agentRepo.find({
        where: { isDelete: false, active: true },
        order: { createdAt: 'DESC' },
      });
      const scored = agents
        .map((a) => ({ agent: a, score: this.scoreAgent(a, msgKeywords) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
      candidates = scored.map((s) => ({ id: s.agent.id, score: s.score }));
      if (scored.length) picked = scored[0];
    }

    if (!picked || picked.score < th) {
      return { triggered: false, reason: 'below-threshold', candidates };
    }

    const best = picked;
    const shouldStart =
      requireStart === true &&
      typeof sessionId === 'string' &&
      sessionId.length > 0;
    let execId: string | undefined = undefined;
    if (shouldStart && sessionId) {
      const entity = this.execRepo.create({
        agentId: best.agent.id,
        taskDescription:
          typeof message === 'string' && message.trim().length > 0
            ? message.trim()
            : `keywords: ${kwList.join(', ')}`,
        nodeStatus: { startedAt: new Date().toISOString() },
        latestResponse: null,
        contextMessageId: sessionId,
        active: true,
      });
      const saved = await this.execRepo.save(entity);
      execId = saved.id;
    }

    return {
      triggered: true,
      agent: {
        id: best.agent.id,
        nickname: best.agent.nickname,
        codeDir: best.agent.codeDir,
        purpose: best.agent.purpose,
        score: best.score,
      },
      action: shouldStart ? 'started' : 'suggest',
      executionId: execId,
      candidates,
    };
  }

  getHandle() {
    const schema = z
      .object({
        keywords: z
          .array(z.string().min(1))
          .min(1)
          .describe('AI产生的关键词集合（小写/去重可由系统处理）'),
        message: z
          .string()
          .describe('意图文本（可选，用于执行记录的任务说明）')
          .optional(),
        threshold: z
          .number()
          .min(0)
          .describe('触发阈值（>=0，默认1）；分数低于该值则不触发')
          .optional(),
        topK: z
          .number()
          .min(1)
          .max(5)
          .describe('返回前K个候选（默认1，建议不超过5）')
          .optional(),
        requireStart: z
          .boolean()
          .describe('为true且存在有效会话时，创建执行记录并开始Agent对话')
          .optional(),
      })
      .describe(
        '意图分析触发的参数集合；会话由上下文 thread_id 注入，无需提供 sessionId',
      );

    return tool(
      async (
        {
          keywords,
          message,
          threshold,
          topK,
          requireStart,
        }: {
          keywords: string[];
          message?: string;
          threshold?: number;
          topK?: number;
          requireStart?: boolean;
        },
        config?: { configurable?: { thread_id?: string } },
      ) => {
        const threadId = config?.configurable?.thread_id;
        const sessionId = await this.resolveSessionIdFromThread(threadId);
        const result = await this.analyzeAndMaybeStart({
          sessionId,
          keywords,
          message,
          threshold,
          topK,
          requireStart,
        });
        return JSON.stringify(result);
      },
      {
        name: IntentAgentTriggerFunctionDescription.name,
        description: IntentAgentTriggerFunctionDescription.description,
        schema,
      },
    );
  }
}
