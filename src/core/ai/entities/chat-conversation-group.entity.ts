import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from './base.entity';

/**
 * @title Chat Conversation Group Entity
 * @description 对话组实体，支持群聊/私聊/助手/系统/待办类型，并维护参与者列表。
 * @keywords-cn 对话组, 参与者, 群聊, 私聊, 助手
 * @keywords-en conversation-group, participants, group, dm, assistant
 */
@Entity('chat_conversation_groups')
@Index(['dayGroupId'])
@Index(['isDelete'])
@Index(['threadType'])
@Index(['isPinned'])
export class ChatConversationGroupEntity extends BaseAuditedEntity {
  @Column({ name: 'day_group_id', type: 'char', length: 36 })
  dayGroupId!: string;

  @Column({
    name: 'chat_client_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  chatClientId!: string | null;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;

  @Column({
    name: 'thread_type',
    type: 'varchar',
    length: 20,
    default: 'group',
  })
  threadType!: 'assistant' | 'system' | 'todo' | 'group' | 'dm';

  @Column({ name: 'is_pinned', type: 'boolean', default: false })
  isPinned!: boolean;

  @Column({ name: 'is_ai_involved', type: 'boolean', default: false })
  isAiInvolved!: boolean;

  /**
   * @title 参与者列表
   * @description 参与者统一引用 Principal（用户/官方账号/Agent/系统），便于 B2B/B2C 场景统一权限判断。
   * @keywords-cn 参与者, 主体, 用户, 官方账号, Agent
   * @keywords-en participants, principal, user, official, agent
   */
  @Column({ name: 'participants', type: 'json', nullable: true })
  participants!: Array<{
    id: string;
    name?: string;
    principalType?:
      | 'user_enterprise'
      | 'user_consumer'
      | 'official_account'
      | 'agent'
      | 'system';
    tenantId?: string;
  }> | null;
}
