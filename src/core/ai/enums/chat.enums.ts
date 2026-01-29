/**
 * @title 会话类型枚举
 * @description 聊天会话类型枚举，支持私聊、群聊、频道。
 */
export enum ChatSessionType {
  /** 1对1私聊 */
  Private = 'private',
  /** 多人群聊 */
  Group = 'group',
  /** 频道/广播 */
  Channel = 'channel',
}

/**
 * @title 消息类型枚举
 * @description 聊天消息类型枚举。
 */
export enum ChatMessageType {
  /** 文本消息 */
  Text = 'text',
  /** 图片消息 */
  Image = 'image',
  /** 文件消息 */
  File = 'file',
  /** 系统消息 */
  System = 'system',
}

/**
 * @title 会话成员角色枚举
 * @description 会话成员角色枚举。
 */
export enum ChatMemberRole {
  /** 群主/创建者 */
  Owner = 'owner',
  /** 管理员 */
  Admin = 'admin',
  /** 普通成员 */
  Member = 'member',
}
