/**
 * @title useImChatAdapter
 * @description Adapter hook to bridge new IM module with ChatPanel component.
 * @keywords-cn IM适配器, 会话映射, 消息转换
 * @keywords-en im-adapter, session-mapping, message-convert
 */

import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useImChat } from '../../im/im.module';
import { useAuthStore } from '../../auth/store/auth.store';
import type { ImSessionSummary, ImMessageInfo } from '../../im/types/im.types';
import type { ChatMessage, ThreadListItem } from '../types/agent.types';
import { ChatRole } from '../enums/agent.enums';

/**
 * 将 ImSessionSummary 映射为 ThreadListItem
 */
function mapSessionToThread(session: ImSessionSummary): ThreadListItem {
  const threadTypeMap: Record<string, ThreadListItem['threadType']> = {
    private: 'dm',
    group: 'group',
    channel: 'group',
  };

  return {
    id: session.sessionId,
    title: session.name || null,
    chatClientId: null,
    threadType: threadTypeMap[session.type] || 'group',
    isPinned: false,
    isAiInvolved: false,
    lastMessage: session.lastMessagePreview || undefined,
    avatarUrl: session.avatarUrl || null,
    createdAt: session.createdAt,
    updatedAt: session.lastMessageAt || session.createdAt,
    members: [],
  };
}

/**
 * 将 ImMessageInfo 映射为 ChatMessage
 */
function mapImMessageToChatMessage(
  msg: ImMessageInfo,
  status?: ChatMessage['status'],
): ChatMessage {
  // 根据 senderId 判断角色
  // 如果 senderId 是 null 或以 'agent:' 开头，认为是 assistant
  let role = ChatRole.User;
  if (!msg.senderId || msg.senderId.startsWith('agent:')) {
    role = ChatRole.Assistant;
  } else if (msg.messageType === 'system') {
    role = ChatRole.System;
  }

  return {
    id: msg.id,
    role,
    content: msg.content,
    timestamp: new Date(msg.createdAt).getTime(),
    tool_calls: [],
    senderId: msg.senderId,
    senderName: msg.senderName,
    status,
  };
}

export interface UseImChatAdapterOptions {
  onAiToken?: (text: string) => void;
  onAiStreamEnd?: () => void;
  onError?: (error: string) => void;
}

export function useImChatAdapter(_options?: UseImChatAdapterOptions) {
  const authStore = useAuthStore();
  const imChat = useImChat();
  const { principal } = storeToRefs(authStore);

  // 映射后的会话列表
  const threads = computed<ThreadListItem[]>(() => {
    return imChat.sessions.value.map(mapSessionToThread);
  });

  // 映射后的消息列表
  const chatMessages = computed<ChatMessage[]>(() => {
    const statusMap = imChat.sendStatusByMessageId.value;
    return imChat.messages.value.map((m) =>
      mapImMessageToChatMessage(m, statusMap[m.id]),
    );
  });

  // AI 流式响应状态
  const streamingMessage = ref<ChatMessage | null>(null);

  // 连接 WebSocket
  function connect() {
    imChat.connect();
  }

  // 断开 WebSocket
  function disconnect() {
    imChat.disconnect();
  }

  // 加载会话列表
  async function loadSessions() {
    await imChat.loadSessions();
  }

  // 加入会话
  async function joinSession(sessionId: string) {
    await imChat.joinSession(sessionId);
  }

  // 离开当前会话
  function leaveSession() {
    imChat.leaveSession();
  }

  // 发送消息
  async function sendMessage(
    content: string,
    attachments?: Array<{
      type: string;
      url: string;
      name?: string;
      size?: number;
    }>,
  ) {
    await imChat.sendMessage(content, { attachments });
  }

  // 发送输入状态
  function sendTyping(isTyping: boolean) {
    imChat.sendTyping(isTyping);
  }

  // 标记已读
  function markAsRead(messageId: string) {
    imChat.markAsRead(messageId);
  }

  // 创建新会话
  async function createSession(request: {
    type: 'private' | 'group' | 'channel';
    name?: string;
    memberIds?: string[];
  }) {
    return await imChat.createSession(request);
  }

  // 加载更多消息
  async function loadMoreMessages() {
    await imChat.loadMoreMessages();
  }

  // 获取当前会话 ID
  const currentSessionId = computed(() => {
    return imChat.currentSession.value?.sessionId || null;
  });

  // 获取当前会话标题
  const currentSessionTitle = computed(() => {
    const s = imChat.currentSession.value;
    if (!s) return '';
    const selfId = principal.value?.id || '';
    if (s.type === 'private') {
      const other = s.members.find((m) =>
        selfId ? m.principalId !== selfId : true,
      );
      return other?.displayName || s.name || '';
    }
    if (s.type === 'group' || s.type === 'channel') {
      return s.name || '群聊';
    }
    return s.name || '';
  });

  // 输入状态
  const isTyping = imChat.isTyping;
  const typingUsersList = imChat.typingUsersList;

  // AI 流式状态
  const aiStreaming = imChat.aiStreaming;
  const aiStreamContent = imChat.aiStreamContent;

  // 状态
  const loading = imChat.loading;
  const error = imChat.error;
  const connected = imChat.connected;

  return {
    // 映射后的数据
    threads,
    chatMessages,

    // 原始 IM 数据 (用于更细粒度控制)
    sessions: imChat.sessions,
    messages: imChat.messages,
    currentSession: imChat.currentSession,

    // 状态
    loading,
    error,
    connected,
    currentSessionId,
    currentSessionTitle,

    // 输入状态
    isTyping,
    typingUsersList,

    // AI 流式
    aiStreaming,
    aiStreamContent,
    streamingMessage,

    // 方法
    connect,
    disconnect,
    loadSessions,
    joinSession,
    leaveSession,
    sendMessage,
    sendTyping,
    markAsRead,
    createSession,
    loadMoreMessages,
  };
}
