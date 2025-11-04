import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
// 直接从 types 文件导入以避免模块导出混淆
import type { AICoreModuleOptions } from '../types/module.types';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ChatMessage,
  ChatContext,
  PromptTemplate,
  ContextConfig,
  MessageStats,
  ContextSummary,
} from '../types';
import {
  ChatSessionEntity,
  PromptTemplateEntity,
  ChatMessageEntity,
} from '../entities';
import { MessageKeywordsService } from './message.keywords.service';

/**
 * 上下文服务
 * 负责管理对话上下文、处理 prompt 模板和消息历史，支持内存缓存和数据库持久化。
 *
 * @keywords context-service, session-management, keyword-extraction, keyword-filtering,
 * sliding-window, prompt-template, analytics, cleanup, non-system-window, system-message
 */
@Injectable()
export class ContextService {
  private contexts = new Map<string, ChatContext>();
  private defaultConfig: ContextConfig = {
    maxMessages: 100,
    maxContextLength: 10000,
    maxContextAge: 3600000, // 1小时
    cleanupInterval: 300000, // 5分钟
    expirationHours: 24,
    autoCleanup: true,
    analysisWindowSize: 5,
  };

  constructor(
    @Inject('AI_CORE_OPTIONS')
    private readonly aiCoreOptions: AICoreModuleOptions | undefined,
    @InjectRepository(ChatSessionEntity)
    private readonly chatSessionRepository: Repository<ChatSessionEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly chatMessageRepository: Repository<ChatMessageEntity>,
    @InjectRepository(PromptTemplateEntity)
    private readonly promptTemplateRepository: Repository<PromptTemplateEntity>,
    private readonly messageKeywordsService: MessageKeywordsService,
  ) {
    // 在服务构造时优先合并模块传入的上下文配置
    this.applyContextOptionsFromModule();
  }

  /**
   * 模块初始化钩子：通过构造函数注入的 AI_CORE_OPTIONS 合并上下文配置
   *
   * @returns void
   * @keywords configuration, module-options, context-config, defaults-merge
   */
  private applyContextOptionsFromModule(): void {
    const ctx = this.aiCoreOptions?.context;
    if (ctx && typeof ctx === 'object') {
      this.defaultConfig = {
        ...this.defaultConfig,
        ...ctx,
      };
    }
  }

  /**
   * 创建或更新对话上下文（支持不传 sessionId 自动新建）
   * - 传入 sessionId：若存在则更新；不存在则以该 id 创建
   * - 不传 sessionId：自动生成新的会话并返回
   * - 若提供 systemPrompt，将插入一条系统消息（去重）
   *
   * @param sessionId 可选，会话唯一标识
   * @param systemPrompt 可选，系统提示词
   * @param userId 可选，创建/更新的用户 id（审计字段）
   * @returns ChatContext 创建/更新后的上下文对象
   * @keywords context, session, upsert, system-prompt, initialization
   */
  async createContext(
    sessionId?: string,
    systemPrompt?: string,
    userId?: string,
  ): Promise<ChatContext> {
    // 每次首次创建上下文时尝试应用模块配置（幂等）
    this.applyContextOptionsFromModule();

    // 统一的会话创建/更新逻辑：
    // - 传入 sessionId：更新（若不存在则创建）
    // - 未传入 sessionId：创建新的会话并生成 sessionId
    const metadata = userId ? { userId } : {};
    const sessionEntity = await this.ensureSession(
      sessionId,
      systemPrompt,
      metadata,
    );
    const sid = sessionEntity.sessionId;

    const context: ChatContext = {
      sessionId: sid,
      messages: [],
      systemPrompt: sessionEntity.systemPrompt ?? systemPrompt,
      metadata: sessionEntity.metadata ?? metadata,
      createdAt: sessionEntity.createdAt ?? new Date(),
      updatedAt: sessionEntity.updatedAt ?? new Date(),
    };

    // 如果提供了 systemPrompt，则写入一条系统消息（仅当最新系统消息不同内容时）
    if (systemPrompt) {
      const latestSystemMsg = await this.chatMessageRepository.findOne({
        where: { sessionId: sid, role: 'system', isDelete: false },
        order: { createdAt: 'DESC' },
      });
      const shouldInsert =
        !latestSystemMsg || latestSystemMsg.content !== systemPrompt;
      if (shouldInsert) {
        await this.chatMessageRepository.save(
          this.chatMessageRepository.create({
            sessionId: sid,
            role: 'system',
            content: systemPrompt,
            metadata: undefined,
            createdUser: userId,
            updateUser: userId,
            channelId: context.metadata?.channelId,
            isDelete: false,
          }),
        );
      }
      context.messages.push({
        role: 'system',
        content: systemPrompt,
        timestamp: new Date(),
      });
    }

    this.contexts.set(sid, context);
    return context;
  }

  /**
   * 获取对话上下文（优先从内存缓存，否则从数据库加载）
   *
   * @param sessionId 会话唯一标识
   * @returns ChatContext | undefined 若不存在返回 undefined
   * @keywords context, cache, lazy-load, persistence
   */
  async getContext(sessionId: string): Promise<ChatContext | undefined> {
    // 先从内存缓存获取
    let context = this.contexts.get(sessionId);

    if (!context) {
      // 从数据库加载
      context = await this.loadContextFromDatabase(sessionId);
      if (context) {
        this.contexts.set(sessionId, context);
      }
    }

    return context;
  }

  /**
   * 添加消息到上下文（持久化到消息表，并进行关键词提取存储）
   *
   * @param sessionId 会话唯一标识
   * @param message 消息内容（不包含 timestamp，内部补齐）
   * @returns void
   * @keywords message, persistence, keyword-extraction, audit, trimming
   */
  async addMessage(
    sessionId: string,
    message: Omit<ChatMessage, 'timestamp'>,
  ): Promise<void> {
    const context = await this.getContext(sessionId);
    if (!context) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }

    const now = new Date();
    const chatMessage: ChatMessage = {
      ...message,
      timestamp: now,
    };

    // 先更新内存上下文（仅作为缓存，不作为持久化的来源）
    context.messages.push(chatMessage);
    context.updatedAt = now;

    // 持久化单条消息
    const saved = await this.chatMessageRepository.save(
      this.chatMessageRepository.create({
        sessionId,
        role: chatMessage.role,
        content: chatMessage.content,
        metadata: chatMessage.metadata,
        createdUser: context.metadata?.userId,
        updateUser: context.metadata?.userId,
        channelId: context.metadata?.channelId,
        isDelete: false,
      }),
    );

    // 关键词分析（异步执行，但不阻塞主流程）
    try {
      const kw = await this.messageKeywordsService.extractKeywords(
        chatMessage.content,
      );
      await this.chatMessageRepository.update(
        { id: saved.id },
        { keywords: kw },
      );
    } catch {
      // 关键词分析失败不影响消息保存
    }

    // 针对非系统消息执行窗口裁剪（只保留最近 maxMessages 条）
    await this.trimContext(sessionId, this.defaultConfig.maxMessages);
  }

  /**
   * 获取格式化的消息历史（只返回非系统消息，并可选前置一条系统消息）
   *
   * @param sessionId 会话唯一标识
   * @param includeSystem 是否前置系统消息
   * @returns ChatMessage[] 格式化后的消息列表
   * @keywords formatted, non-system, system-message, max-context
   */
  async getFormattedMessages(
    sessionId: string,
    includeSystem = true,
  ): Promise<ChatMessage[]> {
    // 从数据库查询最近的非系统消息（以 maxMessages 为上限）
    const session = await this.chatSessionRepository.findOne({
      where: { sessionId, active: true, isDelete: false },
    });
    if (!session) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }

    const rows = await this.chatMessageRepository
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: sessionId })
      .andWhere('m.is_delete = 0')
      .andWhere('m.role != :role', { role: 'system' })
      .orderBy('m.created_at', 'ASC')
      .limit(this.defaultConfig.maxMessages)
      .getMany();

    const msgs: ChatMessage[] = rows.map((r) => ({
      role: r.role,
      content: r.content,
      timestamp: r.createdAt,
      metadata: r.metadata ?? undefined,
    }));

    if (includeSystem) {
      // 优先使用消息表中最新的系统消息，否则回退到 session.systemPrompt
      const latestSystem = await this.chatMessageRepository.findOne({
        where: { sessionId, role: 'system', isDelete: false },
        order: { createdAt: 'DESC' },
      });
      const sysContent = latestSystem?.content ?? session.systemPrompt;
      if (sysContent) {
        return [
          {
            role: 'system',
            content: sysContent,
            timestamp: latestSystem?.createdAt ?? session.createdAt,
          },
          ...msgs,
        ];
      }
    }
    return msgs;
  }

  /**
   * 获取最近 N 条消息（可选包含系统消息）
   * - 默认只返回非系统消息的最近 N 条，避免系统消息挤占窗口
   * - 若 includeSystem=true，则将系统消息置于数组开头返回
   *
   * @param sessionId 会话唯一标识
   * @param limit 窗口大小，默认使用 maxMessages
   * @param includeSystem 是否前置系统消息
   * @returns ChatMessage[] 最近窗口的消息
   * @keywords recent-window, non-system, system-message, query-builder
   */
  async getRecentMessages(
    sessionId: string,
    limit?: number,
    includeSystem = false,
  ): Promise<ChatMessage[]> {
    const session = await this.chatSessionRepository.findOne({
      where: { sessionId, active: true, isDelete: false },
    });
    if (!session) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }
    const n =
      typeof limit === 'number' && limit > 0
        ? limit
        : this.defaultConfig.maxMessages;
    // 仅取最近 n 条非系统消息，避免系统消息挤占窗口
    const rows = await this.chatMessageRepository
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: sessionId })
      .andWhere('m.is_delete = 0')
      .andWhere('m.role != :role', { role: 'system' })
      .orderBy('m.created_at', 'DESC')
      .limit(n)
      .getMany();
    const msgs = rows
      .slice()
      .reverse()
      .map((r) => ({
        role: r.role,
        content: r.content,
        timestamp: r.createdAt,
        metadata: r.metadata ?? undefined,
      }));
    if (includeSystem && session.systemPrompt) {
      return [
        {
          role: 'system',
          content: session.systemPrompt,
          timestamp: session.createdAt,
        },
        ...msgs,
      ];
    }
    return msgs;
  }

  /**
   * 获取分析窗口（最近 N 条）消息，默认包含系统消息
   *
   * @param sessionId 会话唯一标识
   * @param includeSystem 是否前置系统消息
   * @returns ChatMessage[] 分析窗口的消息
   * @keywords analysis-window, sliding-window, system-message
   */
  async getAnalysisWindow(
    sessionId: string,
    includeSystem = true,
  ): Promise<ChatMessage[]> {
    const n = this.defaultConfig.analysisWindowSize ?? 5;
    return this.getRecentMessages(sessionId, n, includeSystem);
  }

  /**
   * 清理上下文历史（保留最近 N 条非系统消息，其他标记软删除）
   *
   * @param sessionId 会话唯一标识
   * @param maxMessages 最大保留条数
   * @returns void
   * @keywords trimming, soft-delete, retention, non-system
   */
  async trimContext(sessionId: string, maxMessages: number): Promise<void> {
    // 使用数据库进行裁剪：对非系统消息进行软删除，保留最近 maxMessages 条
    const rows = await this.chatMessageRepository.find({
      where: { sessionId, isDelete: false },
      order: { createdAt: 'DESC' },
    });
    const nonSystem = rows.filter((r) => r.role !== 'system');
    if (nonSystem.length <= maxMessages) return;
    const toDelete = nonSystem.slice(maxMessages);
    const ids = toDelete.map((r) => r.id);
    if (ids.length) {
      await this.chatMessageRepository
        .createQueryBuilder()
        .update()
        .set({ isDelete: true })
        .where('id IN (:...ids)', { ids })
        .execute();
      await this.chatMessageRepository
        .createQueryBuilder()
        .softDelete()
        .where('id IN (:...ids)', { ids })
        .execute();
    }
  }

  /**
   * 删除对话上下文（软删除会话和相关消息）
   *
   * @param sessionId 会话唯一标识
   * @returns boolean 是否从内存缓存中移除成功
   * @keywords delete-session, soft-delete, cascade
   */
  async deleteContext(sessionId: string): Promise<boolean> {
    const deleted = this.contexts.delete(sessionId);

    // 软删除：先标记 is_delete，再执行软删除（deleted_at）
    await this.chatSessionRepository.update(
      { sessionId },
      { isDelete: true, active: false },
    );
    await this.chatSessionRepository.softDelete({ sessionId });

    // 同步删除消息记录
    await this.chatMessageRepository
      .createQueryBuilder()
      .update()
      .set({ isDelete: true })
      .where('session_id = :sid', { sid: sessionId })
      .execute();
    await this.chatMessageRepository
      .createQueryBuilder()
      .softDelete()
      .where('session_id = :sid', { sid: sessionId })
      .execute();

    return deleted;
  }

  /**
   * 创建 Prompt 模板（带审计字段）
   *
   * @param template 模板内容（不包含 id/createdAt/updatedAt）
   * @param userId 可选，审计字段：创建人
   * @param channelId 可选，审计字段：渠道
   * @returns PromptTemplate 创建后的模板实体
   * @keywords prompt-template, creation, audit
   */
  async createPromptTemplate(
    template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    userId?: string,
    channelId?: string,
  ): Promise<PromptTemplate> {
    const entity = this.promptTemplateRepository.create({
      ...template,
      createdAt: new Date(),
      updatedAt: new Date(),
      // 审计字段赋值
      createdUser: userId,
      updateUser: userId,
      channelId,
    });

    const saved = await this.promptTemplateRepository.save(entity);
    return saved as PromptTemplate;
  }

  /**
   * 渲染 Prompt 模板（变量替换与未解析校验）
   *
   * @param templateId 模板 id
   * @param variables 变量字典，用于替换 {{var}} 占位符
   * @returns string 渲染后的结果字符串
   * @keywords template-render, variables, validation
   */
  async renderPrompt(
    templateId: string,
    variables: Record<string, any>,
  ): Promise<string> {
    const template = await this.promptTemplateRepository.findOne({
      where: { id: templateId, enabled: true, isDelete: false },
    });

    if (!template) {
      throw new Error(`Prompt template not found: ${templateId}`);
    }

    let rendered = template.template;

    // 替换变量
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    // 检查是否还有未替换的变量
    const unreplacedVars = rendered.match(/\{\{[^}]+\}\}/g);
    if (unreplacedVars) {
      throw new Error(
        `Unresolved variables in template: ${unreplacedVars.join(', ')}`,
      );
    }

    return rendered;
  }

  /**
   * 获取所有 Prompt 模板（可选按分类过滤）
   *
   * @param category 可选，模板分类
   * @returns PromptTemplate[] 模板列表
   * @keywords prompt-template, list, category-filter
   */
  async getPromptTemplates(category?: string): Promise<PromptTemplate[]> {
    const where = category
      ? { enabled: true, category, isDelete: false }
      : { enabled: true, isDelete: false };
    return await this.promptTemplateRepository.find({ where });
  }

  /**
   * 获取指定 Prompt 模板
   *
   * @param templateId 模板 id
   * @returns PromptTemplate | null 模板实体或 null
   * @keywords prompt-template, read, fetch
   */
  async getPromptTemplate(templateId: string): Promise<PromptTemplate | null> {
    return await this.promptTemplateRepository.findOne({
      where: { id: templateId, enabled: true, isDelete: false },
    });
  }

  /**
   * 更新上下文元数据（并持久化到会话表）
   *
   * @param sessionId 会话唯一标识
   * @param metadata 元数据字典
   * @returns void
   * @keywords metadata, context, persistence
   */
  async updateContextMetadata(
    sessionId: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    const context = await this.getContext(sessionId);
    if (!context) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }

    context.metadata = { ...context.metadata, ...metadata };
    context.updatedAt = new Date();

    // 更新数据库
    await this.saveContextToDatabase(context);
  }

  /**
   * 获取所有活跃的会话 ID（来自内存缓存）
   *
   * @returns string[] 会话 id 数组
   * @keywords active-sessions, cache
   */
  getActiveSessions(): string[] {
    return Array.from(this.contexts.keys());
  }

  /**
   * 获取上下文统计信息（计数与总字符数）
   *
   * @param sessionId 会话唯一标识
   * @returns MessageStats 统计信息
   * @keywords stats, counts, characters, aggregation
   */
  async getContextStats(sessionId: string): Promise<MessageStats> {
    const [totalMessages, userMessages, assistantMessages, systemMessages] =
      await Promise.all([
        this.chatMessageRepository.count({
          where: { sessionId, isDelete: false },
        }),
        this.chatMessageRepository.count({
          where: { sessionId, role: 'user', isDelete: false },
        }),
        this.chatMessageRepository.count({
          where: { sessionId, role: 'assistant', isDelete: false },
        }),
        this.chatMessageRepository.count({
          where: { sessionId, role: 'system', isDelete: false },
        }),
      ]);
    const totalCharactersRes = await this.chatMessageRepository
      .createQueryBuilder('m')
      .select('SUM(CHAR_LENGTH(m.content))', 'sum')
      .where('m.session_id = :sid', { sid: sessionId })
      .andWhere('m.is_delete = 0')
      .getRawOne<{ sum: string | number | null }>();
    const totalCharacters = totalCharactersRes?.sum
      ? Number(totalCharactersRes.sum)
      : 0;

    return {
      totalMessages,
      userMessages,
      assistantMessages,
      systemMessages,
      totalCharacters,
    };
  }

  /**
   * 获取分析窗口的消息统计（最近 N 条非系统消息，默认 N=analysisWindowSize）
   *
   * @param sessionId 会话唯一标识
   * @param limit 可选，窗口大小
   * @returns MessageStats 统计信息
   * @keywords stats, analysis-window, non-system
   */
  async getContextStatsWindow(
    sessionId: string,
    limit?: number,
  ): Promise<MessageStats> {
    const messages = await this.getRecentMessages(
      sessionId,
      limit ?? this.defaultConfig.analysisWindowSize ?? 5,
      false,
    );

    const stats: MessageStats = {
      totalMessages: messages.length,
      userMessages: messages.filter((m) => m.role === 'user').length,
      assistantMessages: messages.filter((m) => m.role === 'assistant').length,
      systemMessages: 0,
      totalCharacters: messages.reduce((sum, m) => sum + m.content.length, 0),
    };

    return stats;
  }

  /**
   * 获取上下文摘要（最近活动时间与估算时长）
   *
   * @param sessionId 会话唯一标识
   * @returns ContextSummary 摘要信息
   * @keywords summary, last-activity, duration
   */
  async getContextSummary(sessionId: string): Promise<ContextSummary> {
    const session = await this.chatSessionRepository.findOne({
      where: { sessionId, active: true, isDelete: false },
    });
    if (!session) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }
    const stats = await this.getContextStats(sessionId);
    const last = await this.chatMessageRepository.findOne({
      where: { sessionId, isDelete: false },
      order: { createdAt: 'DESC' },
    });
    const first = await this.chatMessageRepository.findOne({
      where: { sessionId, isDelete: false },
      order: { createdAt: 'ASC' },
    });
    const lastActivity = last?.updatedAt ?? session.updatedAt;
    const start = first?.createdAt ?? session.createdAt;
    const duration = Math.max(
      0,
      Math.floor((lastActivity.getTime() - start.getTime()) / (1000 * 60)),
    );

    return { sessionId, stats, lastActivity, duration };
  }

  /**
   * 获取分析窗口的上下文摘要（最近 N 条非系统消息）
   *
   * @param sessionId 会话唯一标识
   * @param limit 可选，窗口大小
   * @returns ContextSummary 摘要信息
   * @keywords summary, analysis-window
   */
  async getContextSummaryWindow(
    sessionId: string,
    limit?: number,
  ): Promise<ContextSummary> {
    const messages = await this.getRecentMessages(
      sessionId,
      limit ?? this.defaultConfig.analysisWindowSize ?? 5,
      false,
    );
    const lastActivity =
      messages.length > 0
        ? (messages[messages.length - 1].timestamp ?? new Date())
        : new Date();
    const stats = await this.getContextStatsWindow(sessionId, limit);

    // 使用最近窗口来估算会话时长（仅供参考）
    const duration =
      messages.length > 0
        ? Math.max(
            0,
            Math.round(
              (lastActivity.getTime() -
                (messages[0].timestamp?.getTime() ?? lastActivity.getTime())) /
                1000 /
                60,
            ),
          )
        : 0;

    return {
      sessionId,
      stats,
      lastActivity,
      duration,
    };
  }

  /**
   * 清理过期的上下文（软删除超过指定小时的会话与消息）
   *
   * @param maxAgeHours 过期时长（小时），默认 24
   * @returns number 清理数量（缓存 + 会话 + 消息）
   * @keywords cleanup, expiration, soft-delete
   */
  async cleanupExpiredContexts(maxAgeHours = 24): Promise<number> {
    const now = new Date();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    let cleanedCount = 0;

    // 清理内存缓存
    for (const [sessionId, context] of this.contexts.entries()) {
      const age = now.getTime() - context.updatedAt.getTime();
      if (age > maxAge) {
        this.contexts.delete(sessionId);
        cleanedCount++;
      }
    }

    // 清理数据库（软删除 + 标记 is_delete）
    const cutoffDate = new Date(now.getTime() - maxAge);
    await this.chatSessionRepository
      .createQueryBuilder()
      .update()
      .set({ isDelete: true, active: false })
      .where('updated_at < :cutoffDate', { cutoffDate })
      .execute();

    const result = await this.chatSessionRepository
      .createQueryBuilder()
      .softDelete()
      .where('updated_at < :cutoffDate', { cutoffDate })
      .execute();

    // 同步清理消息记录
    await this.chatMessageRepository
      .createQueryBuilder()
      .update()
      .set({ isDelete: true })
      .where('updated_at < :cutoffDate', { cutoffDate })
      .execute();
    const msgResult = await this.chatMessageRepository
      .createQueryBuilder()
      .softDelete()
      .where('updated_at < :cutoffDate', { cutoffDate })
      .execute();

    return cleanedCount + (result.affected || 0) + (msgResult.affected || 0);
  }

  /**
   * 更新 Prompt 模板（带审计字段）
   *
   * @param templateId 模板 id
   * @param patch 变更内容（不包含 id/createdAt/updatedAt）
   * @param userId 可选，审计字段：更新人
   * @param channelId 可选，审计字段：渠道
   * @returns PromptTemplate | null 更新后的模板或 null
   * @keywords prompt-template, update, audit
   */
  async updatePromptTemplate(
    templateId: string,
    patch: Partial<Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>>,
    userId?: string,
    channelId?: string,
  ): Promise<PromptTemplate | null> {
    const existing = await this.promptTemplateRepository.findOne({
      where: { id: templateId, isDelete: false },
    });
    if (!existing) return null;

    const merged = this.promptTemplateRepository.merge(existing, {
      ...patch,
      // 审计字段：更新人和渠道
      updateUser: userId ?? existing.updateUser,
      channelId: channelId ?? existing.channelId,
    });

    const saved = await this.promptTemplateRepository.save(merged);
    return saved as PromptTemplate;
  }

  /**
   * 软删除 Prompt 模板
   *
   * @param templateId 模板 id
   * @param userId 可选，审计字段：更新人
   * @returns boolean 是否软删除成功
   * @keywords prompt-template, delete, soft-delete
   */
  async deletePromptTemplate(
    templateId: string,
    userId?: string,
  ): Promise<boolean> {
    await this.promptTemplateRepository.update(
      { id: templateId },
      { isDelete: true, enabled: false, updateUser: userId },
    );
    const result = await this.promptTemplateRepository.softDelete({
      id: templateId,
    });
    return (result.affected ?? 0) > 0;
  }

  /**
   * 确保会话存在（有则更新，无则创建），并返回持久化后的实体
   *
   * @param sessionId 可选，会话 id
   * @param systemPrompt 可选，系统提示词
   * @param metadata 可选，元数据（包含 userId/channelId 等）
   * @returns ChatSessionEntity 持久化后的实体
   * @keywords session-upsert, audit-fields, metadata-merge
   */
  private async ensureSession(
    sessionId?: string,
    systemPrompt?: string,
    metadata?: Record<string, any>,
  ): Promise<ChatSessionEntity> {
    const sid = sessionId ?? randomUUID();
    const existing = await this.chatSessionRepository.findOne({
      where: { sessionId: sid },
    });

    const entity = this.chatSessionRepository.create({
      sessionId: sid,
      userId: metadata?.userId ?? existing?.userId ?? undefined,
      systemPrompt: systemPrompt ?? existing?.systemPrompt ?? undefined,
      metadata: { ...(existing?.metadata ?? {}), ...(metadata ?? {}) },
      active: true,
      // 审计字段
      createdUser: existing
        ? existing.createdUser
        : (metadata?.userId ?? undefined),
      updateUser: metadata?.userId ?? existing?.updateUser ?? undefined,
      channelId: metadata?.channelId ?? existing?.channelId ?? undefined,
      isDelete: false,
    });

    if (existing) {
      entity.id = existing.id;
    }

    return await this.chatSessionRepository.save(entity);
  }

  /**
   * 基于关键词获取上下文窗口（滑动对话）
   * - keywords: 关键词列表（由 AI function call 判定）
   * - includeSystem: 是否在开头插入系统消息
   * - limit: 最大窗口大小（默认使用 analysisWindowSize）
   * - matchMode: 匹配模式（any: 至少包含一个；all: 必须全部包含）
   *
   * @param sessionId 会话唯一标识
   * @param keywords 关键词列表
   * @param includeSystem 是否前置系统消息
   * @param limit 可选，窗口大小
   * @param matchMode 匹配模式（any/all）
   * @returns ChatMessage[] 滑动窗口的消息
   * @keywords keyword-filtering, sliding-window, mysql-json-search, sqlite-like
   */
  async getKeywordContext(
    sessionId: string,
    keywords: string[],
    includeSystem = true,
    limit?: number,
    matchMode: 'any' | 'all' = 'any',
  ): Promise<ChatMessage[]> {
    const session = await this.chatSessionRepository.findOne({
      where: { sessionId, active: true, isDelete: false },
    });
    if (!session) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }

    const cleaned = Array.from(
      new Set(
        (keywords || [])
          .map((k) => (typeof k === 'string' ? k.trim() : ''))
          .filter((k) => k.length > 0),
      ),
    );

    const n =
      typeof limit === 'number' && limit > 0
        ? limit
        : (this.defaultConfig.analysisWindowSize ?? 5);

    // 若未提供关键词，退回最近窗口的默认实现
    if (cleaned.length === 0) {
      return this.getRecentMessages(sessionId, n, includeSystem);
    }

    // 尝试基于数据库进行关键词筛选（MySQL/SQLite 兼容）
    const matchedRows = await this.queryMessagesByKeywords(
      sessionId,
      cleaned,
      Math.max(n * 4, this.defaultConfig.maxMessages),
      matchMode,
    );

    // 若数据库层面无匹配，则退回最近窗口
    if (matchedRows.length === 0) {
      return this.getRecentMessages(sessionId, n, includeSystem);
    }

    // 为了构造滑动窗口，需要在内存中基于时间序列进行切片
    const allRows = await this.chatMessageRepository.find({
      where: { sessionId, isDelete: false },
      order: { createdAt: 'ASC' },
      take: this.defaultConfig.maxMessages,
    });
    const nonSystem = allRows.filter((r) => r.role !== 'system');
    const indexMap = new Map(nonSystem.map((r, idx) => [r.id, idx] as const));
    const matchedIndices = matchedRows
      .map((r) => indexMap.get(r.id))
      .filter((i): i is number => typeof i === 'number')
      .sort((a, b) => a - b);

    // 选择“命中最密集”的滑动窗口（若密度并列，则选择更靠近最近的窗口）
    const { start, end } = this.pickDensestWindow(
      matchedIndices,
      nonSystem.length,
      n,
    );
    const windowRows = nonSystem.slice(start, end);

    const msgs: ChatMessage[] = windowRows.map((r) => ({
      role: r.role,
      content: r.content,
      timestamp: r.createdAt,
      metadata: r.metadata ?? undefined,
    }));

    if (includeSystem) {
      const latestSystem = await this.chatMessageRepository.findOne({
        where: { sessionId, role: 'system', isDelete: false },
        order: { createdAt: 'DESC' },
      });
      const sysContent = latestSystem?.content ?? session.systemPrompt;
      if (sysContent) {
        return [
          {
            role: 'system',
            content: sysContent,
            timestamp: latestSystem?.createdAt ?? session.createdAt,
          },
          ...msgs,
        ];
      }
    }
    return msgs;
  }

  /**
   * 基于关键词获取上下文窗口（按用户范围，跨会话检索，最终窗口落在最近命中的会话）
   * - 当提供 sessionId 时请使用 getKeywordContext；本方法用于未提供 sessionId 的场景
   * - includeSystem 默认 false
   * - limit 必填且严格限制返回条目数
   *
   * @param userId 用户唯一标识
   * @param keywords 关键词列表
   * @param includeSystem 是否前置系统消息（默认 false）
   * @param limit 窗口大小（必填）
   * @param matchMode 匹配模式（any/all）默认 any
   * @returns ChatMessage[] 滑动窗口的消息
   * @keywords user-scope, keyword-filtering, sliding-window, mysql-json-search, sqlite-like
   */
  async getKeywordContextByUser(
    userId: string,
    keywords: string[],
    includeSystem = false,
    limit: number,
    matchMode: 'any' | 'all' = 'any',
  ): Promise<ChatMessage[]> {
    const cleaned = Array.from(
      new Set(
        (keywords || [])
          .map((k) => (typeof k === 'string' ? k.trim() : ''))
          .filter((k) => k.length > 0),
      ),
    );

    const n = typeof limit === 'number' && limit > 0 ? limit : 1;

    // 若未提供关键词，退回用户最近会话的默认窗口
    if (cleaned.length === 0) {
      const latest = await this.chatSessionRepository.findOne({
        where: { userId, active: true, isDelete: false },
        order: { updatedAt: 'DESC' },
      });
      if (!latest) return [];
      return this.getRecentMessages(latest.sessionId, n, includeSystem);
    }

    // 尝试在用户范围内进行关键词初筛
    const matchedRows = await this.queryUserMessagesByKeywords(
      userId,
      cleaned,
      Math.max(n * 4, this.defaultConfig.maxMessages),
      matchMode,
    );

    // 若用户范围无匹配，尝试在用户最近会话内做相似度匹配作为兜底
    if (matchedRows.length === 0) {
      const latest = await this.chatSessionRepository.findOne({
        where: { userId, active: true, isDelete: false },
        order: { updatedAt: 'DESC' },
      });
      if (!latest) return [];

      const allRows = await this.chatMessageRepository.find({
        where: { sessionId: latest.sessionId, isDelete: false },
        order: { createdAt: 'ASC' },
        take: this.defaultConfig.maxMessages,
      });
      const nonSystem = allRows.filter((r) => r.role !== 'system');
      const pivotSimIdx = this.selectPivotBySimilarity(cleaned, nonSystem);
      if (pivotSimIdx < 0) {
        return this.getRecentMessages(latest.sessionId, n, includeSystem);
      }

      const half = Math.max(1, Math.floor(n / 2));
      const start = Math.max(0, pivotSimIdx - half);
      const end = Math.min(nonSystem.length, start + n);
      const windowRows = nonSystem.slice(start, end);
      const msgs: ChatMessage[] = windowRows.map((r) => ({
        role: r.role,
        content: r.content,
        timestamp: r.createdAt,
        metadata: r.metadata ?? undefined,
      }));
      if (includeSystem) {
        const latestSystem = await this.chatMessageRepository.findOne({
          where: {
            sessionId: latest.sessionId,
            role: 'system',
            isDelete: false,
          },
          order: { createdAt: 'DESC' },
        });
        const sysContent = latestSystem?.content ?? latest.systemPrompt;
        if (sysContent) {
          return [
            {
              role: 'system',
              content: sysContent,
              timestamp: latestSystem?.createdAt ?? latest.createdAt,
            },
            ...msgs,
          ];
        }
      }
      return msgs;
    }

    // 有命中：以最新命中的会话为 pivot，构造该会话内的滑动窗口
    const latestMatch = matchedRows[matchedRows.length - 1];
    const pivotSessionId = latestMatch.sessionId;

    const allRows = await this.chatMessageRepository.find({
      where: { sessionId: pivotSessionId, isDelete: false },
      order: { createdAt: 'ASC' },
      take: this.defaultConfig.maxMessages,
    });
    const nonSystem = allRows.filter((r) => r.role !== 'system');

    // 仅使用该会话内的命中消息计算索引
    const indexMap = new Map(nonSystem.map((r, idx) => [r.id, idx] as const));
    const matchedIndices = matchedRows
      .filter((r) => r.sessionId === pivotSessionId)
      .map((r) => indexMap.get(r.id))
      .filter((i): i is number => typeof i === 'number')
      .sort((a, b) => a - b);

    // 如果该会话内无索引，回退到最近窗口（避免跨会话窗口混杂）
    if (matchedIndices.length === 0) {
      return this.getRecentMessages(pivotSessionId, n, includeSystem);
    }

    const { start, end } = this.pickDensestWindow(
      matchedIndices,
      nonSystem.length,
      n,
    );
    const windowRows = nonSystem.slice(start, end);

    const msgs: ChatMessage[] = windowRows.map((r) => ({
      role: r.role,
      content: r.content,
      timestamp: r.createdAt,
      metadata: r.metadata ?? undefined,
    }));

    if (includeSystem) {
      const latestSystem = await this.chatMessageRepository.findOne({
        where: { sessionId: pivotSessionId, role: 'system', isDelete: false },
        order: { createdAt: 'DESC' },
      });
      const session = await this.chatSessionRepository.findOne({
        where: { sessionId: pivotSessionId, active: true, isDelete: false },
      });
      const sysContent = latestSystem?.content ?? session?.systemPrompt;
      if (sysContent) {
        return [
          {
            role: 'system',
            content: sysContent,
            timestamp:
              latestSystem?.createdAt ?? session?.createdAt ?? new Date(),
          },
          ...msgs,
        ];
      }
    }
    return msgs;
  }

  /**
   * 在用户范围内查询包含关键词的消息（MySQL/SQLite 兼容）
   * @param userId 用户唯一标识
   * @param keywords 关键词列表
   * @param limit 初始抓取上限
   * @param matchMode 匹配模式
   */
  private async queryUserMessagesByKeywords(
    userId: string,
    keywords: string[],
    limit: number,
    matchMode: 'any' | 'all',
  ): Promise<ChatMessageEntity[]> {
    const conn: DataSource = this.chatMessageRepository.manager.connection;
    const dbType: string = conn?.options?.type ?? 'sqlite';

    const qb = this.chatMessageRepository
      .createQueryBuilder('m')
      .innerJoin(ChatSessionEntity, 's', 's.session_id = m.session_id')
      .where('s.user_id = :uid', { uid: userId })
      .andWhere('s.active = 1')
      .andWhere('s.is_delete = 0')
      .andWhere('m.is_delete = 0')
      .andWhere('m.role != :role', { role: 'system' });

    if (dbType === 'mysql') {
      const clauses = keywords.map(
        (_, i) => `JSON_SEARCH(m.keywords, 'one', :kw${i}) IS NOT NULL`,
      );
      const where = clauses.join(matchMode === 'all' ? ' AND ' : ' OR ');
      qb.andWhere(`(${where})`);
      keywords.forEach((kw, i) => qb.setParameter(`kw${i}`, kw));
    } else {
      const clauses = keywords.map((_, i) => `m.keywords LIKE :kw${i}`);
      const where = clauses.join(matchMode === 'all' ? ' AND ' : ' OR ');
      qb.andWhere(`(${where})`);
      keywords.forEach((kw, i) => qb.setParameter(`kw${i}`, `%"${kw}"%`));
    }

    return qb.orderBy('m.created_at', 'ASC').limit(limit).getMany();
  }

  /**
   * 在已排序的命中索引数组上选择“最优滑动窗口”。
   * - 目标：在固定窗口大小 n 内，命中数量最大；若并列，则选择更靠近最近消息的窗口（end 较大）。
   * - 输入：matchedIndices（升序）、消息总数 total、窗口大小 n。
   * - 输出：窗口的 [start, end) 索引（end 为开区间）。
   */
  private pickDensestWindow(
    matchedIndices: number[],
    total: number,
    n: number,
  ): { start: number; end: number } {
    if (!matchedIndices.length || total <= 0 || n <= 0) {
      return { start: 0, end: Math.min(n, Math.max(0, total)) };
    }

    const maxStart = Math.max(0, total - n);
    let bestStart = 0;
    let bestEnd = Math.min(n, total);
    let bestHits = 0;

    // 双指针在命中索引上滑动，计算每个候选窗口的命中数量
    let j = 0;
    for (let i = 0; i < matchedIndices.length; i++) {
      // 针对当前命中位置，计算一个最靠左的候选窗口起点
      const candidateStart = Math.min(
        Math.max(0, matchedIndices[i] - Math.floor(n / 2)),
        maxStart,
      );
      const candidateEnd = Math.min(candidateStart + n, total);

      // 移动右指针，统计命中数量
      while (j < matchedIndices.length && matchedIndices[j] < candidateEnd) {
        j++;
      }
      // 命中数量：位于 [candidateStart, candidateEnd) 的命中个数
      let k = i;
      while (k < matchedIndices.length && matchedIndices[k] < candidateStart) {
        k++;
      }
      const hits = Math.max(0, j - k);

      // 选择命中更多者；若并列，选择更靠近最近的窗口（end 较大）
      if (hits > bestHits || (hits === bestHits && candidateEnd > bestEnd)) {
        bestHits = hits;
        bestStart = candidateStart;
        bestEnd = candidateEnd;
      }
    }

    return { start: bestStart, end: bestEnd };
  }

  /**
   * 选择最相近的一条消息作为 pivot（使用 Jaccard 相似度），找不到返回 -1
   * @param keywords 清洗后的关键词数组
   * @param rows 非系统消息列表（同一会话）
   */
  private selectPivotBySimilarity(
    keywords: string[],
    rows: ChatMessageEntity[],
    threshold = 0.3,
  ): number {
    const kwTokens = this.tokenize(keywords.join(' '));
    let bestIdx = -1;
    let bestScore = 0;
    rows.forEach((r, idx) => {
      const textTokens = this.tokenize(r.content ?? '');
      const score = this.jaccard(kwTokens, textTokens);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });
    return bestScore >= threshold ? bestIdx : -1;
  }

  /**
   * 简化的分词：英文按单词分割，中文按字符级 bigram/trigram 近似
   */
  private tokenize(text: string): Set<string> {
    const norm = (text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .trim();
    const words = norm.split(/\s+/).filter(Boolean);
    const tokens = new Set<string>();
    // 英文词直接加入
    words.forEach((w) => tokens.add(w));
    // 中文近似：对连续非 ASCII 字符生成 bigram（避免控制字符的正则写法，使用 codePoint 过滤）
    const chinese = Array.from(norm)
      .filter((ch) => (ch.codePointAt(0) ?? 0) > 0x7f)
      .join('');
    for (let i = 0; i < chinese.length - 1; i++) {
      tokens.add(chinese.slice(i, i + 2));
    }
    return tokens;
  }

  /**
   * Jaccard 相似度：交集/并集
   */
  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let inter = 0;
    const union = new Set<string>(a);
    b.forEach((t) => {
      if (a.has(t)) inter++;
      union.add(t);
    });
    return inter / union.size;
  }

  /**
   * 数据库层面关键词筛选（MySQL/SQLite 兼容）
   * - any: 任意命中
   * - all: 必须全部命中
   *
   * @param sessionId 会话唯一标识
   * @param keywords 关键词列表
   * @param limit 初始抓取上限（用于后续滑动窗口）
   * @param matchMode 匹配模式（any/all）
   * @returns ChatMessageEntity[] 命中的消息实体
   * @keywords db-query, json-search, text-like, keyword-index
   */
  private async queryMessagesByKeywords(
    sessionId: string,
    keywords: string[],
    limit: number,
    matchMode: 'any' | 'all',
  ): Promise<ChatMessageEntity[]> {
    const conn: DataSource = this.chatMessageRepository.manager.connection;
    const dbType: string = conn?.options?.type ?? 'sqlite';

    const qb = this.chatMessageRepository
      .createQueryBuilder('m')
      .where('m.session_id = :sid', { sid: sessionId })
      .andWhere('m.is_delete = 0')
      .andWhere('m.role != :role', { role: 'system' });

    if (dbType === 'mysql') {
      // 使用 JSON_SEARCH 查找包含关键词的 JSON 数组
      const clauses = keywords.map(
        (_, i) => `JSON_SEARCH(m.keywords, 'one', :kw${i}) IS NOT NULL`,
      );
      const where = clauses.join(matchMode === 'all' ? ' AND ' : ' OR ');
      qb.andWhere(`(${where})`);
      keywords.forEach((kw, i) => qb.setParameter(`kw${i}`, kw));
    } else {
      // SQLite 退化为 LIKE 搜索 JSON 文本
      const clauses = keywords.map((_, i) => `m.keywords LIKE :kw${i}`);
      const where = clauses.join(matchMode === 'all' ? ' AND ' : ' OR ');
      qb.andWhere(`(${where})`);
      keywords.forEach((kw, i) => qb.setParameter(`kw${i}`, `%"${kw}"%`));
    }

    return qb.orderBy('m.created_at', 'ASC').limit(limit).getMany();
  }

  /**
   * 保存上下文到数据库（有则更新，无则创建）
   *
   * @param context 上下文对象
   * @returns void
   * @keywords persist-session, upsert, audit
   */
  private async saveContextToDatabase(context: ChatContext): Promise<void> {
    const existing = await this.chatSessionRepository.findOne({
      where: { sessionId: context.sessionId },
    });

    const entity = this.chatSessionRepository.create({
      sessionId: context.sessionId,
      userId: context.metadata?.userId || undefined,
      systemPrompt: context.systemPrompt || undefined,
      metadata: context.metadata || {},
      active: true,
      // 审计字段：首创建设置 created_user，更新设置 update_user
      createdUser: existing
        ? existing.createdUser
        : context.metadata?.userId || undefined,
      updateUser: context.metadata?.userId || undefined,
      channelId: context.metadata?.channelId || undefined,
      isDelete: false,
    });

    // 如果存在，设置主键以触发更新而不是插入
    if (existing) {
      entity.id = existing.id;
    }

    await this.chatSessionRepository.save(entity);
  }

  /**
   * 从数据库加载上下文（包含消息历史）
   *
   * @param sessionId 会话唯一标识
   * @returns ChatContext | undefined 若不存在返回 undefined
   * @keywords load-context, messages, persistence
   */
  private async loadContextFromDatabase(
    sessionId: string,
  ): Promise<ChatContext | undefined> {
    const session = await this.chatSessionRepository.findOne({
      where: { sessionId, active: true, isDelete: false },
    });
    if (!session) return undefined;
    const rows = await this.chatMessageRepository.find({
      where: { sessionId, isDelete: false },
      order: { createdAt: 'ASC' },
      take: this.defaultConfig.maxMessages,
    });
    const msgs: ChatMessage[] = rows.map((r) => ({
      role: r.role,
      content: r.content,
      timestamp: r.createdAt,
      metadata: r.metadata ?? undefined,
    }));
    return {
      sessionId: session.sessionId,
      messages: msgs,
      systemPrompt: session.systemPrompt,
      metadata: session.metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
