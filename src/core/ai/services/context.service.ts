import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ChatMessage,
  ChatContext,
  PromptTemplate,
  ContextConfig,
  MessageStats,
  ContextSummary,
} from '../types';
import { ChatSessionEntity, PromptTemplateEntity } from '../entities';

/**
 * 上下文服务
 * 负责管理对话上下文、处理prompt模板和消息历史
 * 支持内存缓存和数据库持久化
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
  };

  constructor(
    @InjectRepository(ChatSessionEntity)
    private readonly chatSessionRepository: Repository<ChatSessionEntity>,
    @InjectRepository(PromptTemplateEntity)
    private readonly promptTemplateRepository: Repository<PromptTemplateEntity>,
  ) {}

  /**
   * 创建新的对话上下文
   */
  async createContext(
    sessionId: string,
    systemPrompt?: string,
    userId?: string,
  ): Promise<ChatContext> {
    const context: ChatContext = {
      sessionId,
      messages: [],
      systemPrompt,
      metadata: { userId },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 如果有系统提示词，添加为第一条消息
    if (systemPrompt) {
      context.messages.push({
        role: 'system',
        content: systemPrompt,
        timestamp: new Date(),
      });
    }

    this.contexts.set(sessionId, context);

    // 持久化到数据库
    await this.saveContextToDatabase(context);

    return context;
  }

  /**
   * 获取对话上下文
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
   * 添加消息到上下文
   */
  async addMessage(
    sessionId: string,
    message: Omit<ChatMessage, 'timestamp'>,
  ): Promise<void> {
    const context = await this.getContext(sessionId);
    if (!context) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }

    const chatMessage: ChatMessage = {
      ...message,
      timestamp: new Date(),
    };

    context.messages.push(chatMessage);
    context.updatedAt = new Date();

    // 检查是否需要清理历史
    if (context.messages.length > this.defaultConfig.maxMessages) {
      await this.trimContext(sessionId, this.defaultConfig.maxMessages);
    }

    // 更新数据库
    await this.saveContextToDatabase(context);
  }

  /**
   * 获取格式化的消息历史
   */
  async getFormattedMessages(
    sessionId: string,
    includeSystem = true,
  ): Promise<ChatMessage[]> {
    const context = await this.getContext(sessionId);
    if (!context) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }

    if (includeSystem) {
      return context.messages;
    }

    return context.messages.filter((msg) => msg.role !== 'system');
  }

  /**
   * 清理上下文历史（保留最近N条消息）
   */
  async trimContext(sessionId: string, maxMessages: number): Promise<void> {
    const context = await this.getContext(sessionId);
    if (!context) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }

    // 保留系统消息
    const systemMessages = context.messages.filter(
      (msg) => msg.role === 'system',
    );
    const otherMessages = context.messages.filter(
      (msg) => msg.role !== 'system',
    );

    // 只保留最近的消息
    const trimmedMessages = otherMessages.slice(-maxMessages);

    context.messages = [...systemMessages, ...trimmedMessages];
    context.updatedAt = new Date();

    // 更新数据库
    await this.saveContextToDatabase(context);
  }

  /**
   * 删除对话上下文
   */
  async deleteContext(sessionId: string): Promise<boolean> {
    const deleted = this.contexts.delete(sessionId);

    // 软删除：先标记 is_delete，再执行软删除（deleted_at）
    await this.chatSessionRepository.update(
      { sessionId },
      { isDelete: true, active: false },
    );
    await this.chatSessionRepository.softDelete({ sessionId });

    return deleted;
  }

  /**
   * 创建Prompt模板
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
   * 渲染Prompt模板
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
   * 获取所有Prompt模板
   */
  async getPromptTemplates(category?: string): Promise<PromptTemplate[]> {
    const where = category
      ? { enabled: true, category, isDelete: false }
      : { enabled: true, isDelete: false };
    return await this.promptTemplateRepository.find({ where });
  }

  /**
   * 获取指定Prompt模板
   */
  async getPromptTemplate(templateId: string): Promise<PromptTemplate | null> {
    return await this.promptTemplateRepository.findOne({
      where: { id: templateId, enabled: true, isDelete: false },
    });
  }

  /**
   * 更新上下文元数据
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
   * 获取所有活跃的会话ID
   */
  getActiveSessions(): string[] {
    return Array.from(this.contexts.keys());
  }

  /**
   * 获取上下文统计信息
   */
  async getContextStats(sessionId: string): Promise<MessageStats> {
    const context = await this.getContext(sessionId);
    if (!context) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }

    const stats: MessageStats = {
      totalMessages: context.messages.length,
      userMessages: context.messages.filter((m) => m.role === 'user').length,
      assistantMessages: context.messages.filter((m) => m.role === 'assistant')
        .length,
      systemMessages: context.messages.filter((m) => m.role === 'system')
        .length,
      totalCharacters: context.messages.reduce(
        (sum, m) => sum + m.content.length,
        0,
      ),
    };

    return stats;
  }

  /**
   * 获取上下文摘要
   */
  async getContextSummary(sessionId: string): Promise<ContextSummary> {
    const context = await this.getContext(sessionId);
    if (!context) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }

    const stats = await this.getContextStats(sessionId);
    const duration = Math.floor(
      (context.updatedAt.getTime() - context.createdAt.getTime()) / (1000 * 60),
    );

    return {
      sessionId,
      stats,
      lastActivity: context.updatedAt,
      duration,
    };
  }

  /**
   * 清理过期的上下文
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

    return cleanedCount + (result.affected || 0);
  }

  /**
   * 更新 Prompt 模板（带审计字段）
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
   * 保存上下文到数据库
   */
  private async saveContextToDatabase(context: ChatContext): Promise<void> {
    const existing = await this.chatSessionRepository.findOne({
      where: { sessionId: context.sessionId },
    });

    const entity = this.chatSessionRepository.create({
      sessionId: context.sessionId,
      userId: context.metadata?.userId || undefined,
      messages: context.messages,
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
      // 通过设置主键 id，使 save 进行更新而不是插入
      entity.id = existing.id;
    }

    await this.chatSessionRepository.save(entity);
  }

  /**
   * 从数据库加载上下文
   */
  private async loadContextFromDatabase(
    sessionId: string,
  ): Promise<ChatContext | undefined> {
    const entity = await this.chatSessionRepository.findOne({
      where: { sessionId, active: true, isDelete: false },
    });

    if (!entity) {
      return undefined;
    }

    return {
      sessionId: entity.sessionId,
      messages: entity.messages,
      systemPrompt: entity.systemPrompt,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
