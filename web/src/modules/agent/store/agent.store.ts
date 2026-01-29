/**
 * @title Agent Store
 * @description Pinia store for agent module state, including chat sessions and persistence.
 * @keywords-cn 代理存储, 状态管理, 持久化
 * @keywords-en agent-store, state-management, persistence
 */

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { ChatMessage, GroupHistoryItem } from '../types/agent.types';
import { imApi } from '../../../api/im';
import { useImStore } from '../../im/im.module';
import { ChatHistoryCache } from '../cache/chat-history.cache';
import ImConfigCache from '../cache/im-config.cache';
import { ChatRole } from '../enums/agent.enums';

export const useAgentStore = defineStore('agent', () => {
  const imStore = useImStore();
  // Helper to get local date string YYYY-MM-DD
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // State
  const selectedDate = ref<string>(getLocalDateString());
  const chatClientId = ref<string>('');
  const currentSessionId = ref<string | undefined>(undefined);
  const currentSessionTitle = ref<string>('');
  const threadReadAt = ref<Record<string, string>>({});
  const chatHistoryTable = ref<Record<string, Record<string, ChatMessage[]>>>(
    {},
  );

  // Manual Persistence Implementation
  // Ensures state is restored correctly regardless of plugin initialization timing
  const STORAGE_KEY = 'agent';

  // 1. Initialize from localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as {
        selectedDate?: string;
        chatClientId?: string;
        currentSessionId?: string;
        currentSessionTitle?: string;
        lastVisitedDate?: string;
        threadReadAt?: Record<string, string>;
      };
      const today = getLocalDateString();
      if (!parsed.lastVisitedDate || parsed.lastVisitedDate !== today) {
        selectedDate.value = today;
      } else if (parsed.selectedDate) {
        selectedDate.value = parsed.selectedDate;
      }
      if (parsed.chatClientId) {
        chatClientId.value = parsed.chatClientId;
      }
      if (parsed.currentSessionId) {
        currentSessionId.value = parsed.currentSessionId;
      }
      if (parsed.currentSessionTitle) {
        currentSessionTitle.value = parsed.currentSessionTitle;
      }
      if (parsed.threadReadAt && typeof parsed.threadReadAt === 'object') {
        threadReadAt.value = parsed.threadReadAt;
      }
    }
  } catch (e) {
    console.warn('Failed to restore agent state', e);
  }

  // Ensure chatClientId exists
  if (!chatClientId.value) {
    chatClientId.value = crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);
  }

  // 2. Watch for changes and save to localStorage
  const persistState = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          selectedDate: selectedDate.value,
          chatClientId: chatClientId.value,
          currentSessionId: currentSessionId.value,
          currentSessionTitle: currentSessionTitle.value,
          lastVisitedDate: getLocalDateString(),
          threadReadAt: threadReadAt.value,
        }),
      );
    } catch (e) {
      console.warn('Failed to save agent state', e);
    }
  };

  watch(
    [
      selectedDate,
      chatClientId,
      currentSessionId,
      currentSessionTitle,
      threadReadAt,
    ],
    persistState,
  );

  /**
   * @title 获取当前用户 PrincipalId
   * @description 从 localStorage 中解析当前身份信息，用于读取 chat_session_members 游标。
   * @keywords-cn 主体ID, 本地存储, 读取游标
   * @keywords-en principal-id, local-storage, read-cursor
   */
  function getCurrentPrincipalId(): string | undefined {
    try {
      const principalRaw = localStorage.getItem('principal');
      if (principalRaw) {
        const parsed = JSON.parse(principalRaw) as { id?: string } | null;
        const pid =
          parsed && typeof parsed.id === 'string' ? parsed.id.trim() : '';
        if (pid) return pid;
      }
      const legacy = localStorage.getItem('identity.currentPrincipalId');
      const id = (legacy || '').trim();
      return id || undefined;
    } catch {
      return undefined;
    }
  }

  // Actions
  function setSelectedDate(date: string) {
    selectedDate.value = date;
  }

  function setCurrentSession(id: string | undefined, title: string) {
    currentSessionId.value = id;
    currentSessionTitle.value = title;
  }

  function markThreadRead(id: string, at?: string) {
    if (!id) return;
    const ts = at || new Date().toISOString();
    threadReadAt.value = { ...threadReadAt.value, [id]: ts };
  }

  /**
   * @title 设置会话游标
   * @description 显式设置会话的 lastReadAt（ISO 字符串）。
   * @keywords-cn 会话游标, 已读时间
   * @keywords-en session-cursor, last-read-at
   */
  function setThreadReadCursor(sessionId: string, iso: string) {
    if (!sessionId || !iso) return;
    threadReadAt.value = { ...threadReadAt.value, [sessionId]: iso };
  }

  function ensureSessionDate(sessionId: string, date: string) {
    if (!chatHistoryTable.value[sessionId]) {
      chatHistoryTable.value[sessionId] = {};
    }
    if (!chatHistoryTable.value[sessionId][date]) {
      chatHistoryTable.value[sessionId][date] = [];
    }
    return chatHistoryTable.value[sessionId][date];
  }

  function getSessionMessages(
    sessionId: string | undefined,
    date: string,
  ): ChatMessage[] {
    if (!sessionId) return [];
    return chatHistoryTable.value[sessionId]?.[date] || [];
  }

  function setSessionMessages(
    sessionId: string,
    date: string,
    messages: ChatMessage[],
  ) {
    if (!chatHistoryTable.value[sessionId]) {
      chatHistoryTable.value[sessionId] = {};
    }
    const list = messages.length > 50 ? messages.slice(-50) : messages;
    chatHistoryTable.value[sessionId][date] = list;
  }

  function mergeSessionMessages(
    sessionId: string,
    date: string,
    incoming: ChatMessage[],
  ): ChatMessage[] {
    const local = ensureSessionDate(sessionId, date);
    const byId = new Map<string, ChatMessage>();
    const bySig = new Map<string, string>();
    const makeSig = (x: ChatMessage) =>
      `${x.role}|${x.senderId || ''}|${x.content}|${new Date(x.timestamp).toISOString()}`;

    for (const m of local) {
      byId.set(m.id, m);
      bySig.set(makeSig(m), m.id);
    }

    for (const m of incoming) {
      const incTs = m.timestamp;
      const sig = makeSig(m);
      // reconcile temp messages if same sender/content close in time
      const tempIndex = local.findIndex(
        (x) =>
          typeof x.id === 'string' &&
          x.id.startsWith('temp-') &&
          x.senderId === m.senderId &&
          x.content === m.content &&
          Math.abs(x.timestamp - incTs) <= 120000,
      );
      if (tempIndex !== -1) {
        const replaced: ChatMessage = {
          ...local[tempIndex],
          id: m.id,
          timestamp: incTs,
          status: 'sent',
        };
        bySig.delete(makeSig(local[tempIndex]));
        byId.delete(local[tempIndex].id);
        byId.set(m.id, replaced);
        bySig.set(makeSig(replaced), m.id);
        continue;
      }

      if (byId.has(m.id)) {
        const prev = byId.get(m.id);
        if (prev !== undefined) {
          byId.set(m.id, { ...prev, ...m });
          bySig.set(sig, m.id);
          continue;
        }
      }

      const existingId = bySig.get(sig);
      if (existingId) {
        const existing = byId.get(existingId);
        if (existing) {
          byId.delete(existingId);
          byId.set(m.id, { ...existing, ...m });
          bySig.set(sig, m.id);
          continue;
        }
      }

      byId.set(m.id, m);
      bySig.set(sig, m.id);
    }

    const merged = Array.from(byId.values());
    merged.sort((a, b) => a.timestamp - b.timestamp);
    const trimmed = merged.length > 50 ? merged.slice(-50) : merged;
    chatHistoryTable.value[sessionId][date] = trimmed;
    return trimmed;
  }

  function addSessionMessage(
    sessionId: string,
    date: string,
    message: ChatMessage,
  ): ChatMessage[] {
    const list = ensureSessionDate(sessionId, date);
    if (!list.find((m) => m.id === message.id)) {
      list.push(message);
      if (list.length > 50) {
        list.splice(0, list.length - 50);
      }
    }
    return list;
  }

  function updateSessionMessage(
    sessionId: string,
    date: string,
    id: string,
    patch: Partial<ChatMessage>,
  ): ChatMessage[] {
    const list = ensureSessionDate(sessionId, date);
    const index = list.findIndex((m) => m.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...patch };
    }
    return list;
  }

  function replaceSessionMessage(
    sessionId: string,
    date: string,
    id: string,
    next: ChatMessage,
  ): ChatMessage[] {
    const list = ensureSessionDate(sessionId, date);
    const index = list.findIndex((m) => m.id === id);
    if (index !== -1) {
      list[index] = next;
    }
    return list;
  }

  function removeSessionMessage(
    sessionId: string,
    date: string,
    id: string,
  ): ChatMessage[] {
    const list = ensureSessionDate(sessionId, date);
    const index = list.findIndex((m) => m.id === id);
    if (index !== -1) {
      list.splice(index, 1);
    }
    return list;
  }

  function toHistoryItem(message: ChatMessage): GroupHistoryItem {
    const metadata: Record<string, unknown> = {};
    if (message.senderId) metadata.senderId = message.senderId;
    if (message.senderName) metadata.senderName = message.senderName;
    return {
      role: message.role,
      content: message.content,
      timestamp: new Date(message.timestamp).toISOString(),
      metadata: Object.keys(metadata).length ? metadata : undefined,
    };
  }

  function mapMessagesToHistoryItems(
    messages: ChatMessage[],
  ): GroupHistoryItem[] {
    return messages.map((m) => toHistoryItem(m));
  }

  async function fetchSessionMessages(
    sessionId: string,
    principalId?: string,
    limit: number = 50,
    lastId?: string,
  ): Promise<ChatMessage[]> {
    const list = await imStore.fetchMessagesByLastId(sessionId, limit, lastId);
    const selfId = principalId || undefined;
    const messages: ChatMessage[] = list.map((m) => {
      const senderId = m.senderId ? m.senderId.trim() : m.senderId;
      const role =
        m.messageType === 'system'
          ? ChatRole.System
          : senderId === selfId
            ? ChatRole.User
            : ChatRole.Assistant;
      return {
        id: m.id,
        role,
        content: m.content,
        timestamp: new Date(m.createdAt).getTime(),
        tool_calls: [],
        senderId,
        senderName: m.senderName,
      };
    });
    const dateKey = selectedDate.value;
    const merged = mergeSessionMessages(sessionId, dateKey, messages);
    await ChatHistoryCache.merge(
      sessionId,
      principalId,
      mapMessagesToHistoryItems(merged),
    );
    if (merged.length > 0) {
      const lastMsgId = merged[merged.length - 1].id;
      await ImConfigCache.setLastMessageId(sessionId, principalId, lastMsgId);
    }
    return merged;
  }

  async function syncSession(
    sessionId: string,
    principalId?: string,
  ): Promise<ChatMessage[]> {
    const dateKey = selectedDate.value;
    const local = getSessionMessages(sessionId, dateKey);
    const sinceIdRaw = await ImConfigCache.getLastMessageId(
      sessionId,
      principalId,
    );
    const sinceId = typeof sinceIdRaw === 'string' ? sinceIdRaw : undefined;
    if (!local || local.length === 0) {
      // 初次：刷新会话列表（100），并拉取该会话50条
      // 会话列表由 session store 负责；此处仅拉取该会话的消息
      const msgs = await fetchSessionMessages(sessionId, principalId, 50);
      return msgs;
    }
    if (sinceId) {
      const msgs = await fetchSessionMessages(
        sessionId,
        principalId,
        50,
        sinceId,
      );
      return msgs;
    }
    const msgs = await fetchSessionMessages(sessionId, principalId, 50);
    return msgs;
  }

  function appendLocalMessage(
    sessionId: string,
    principalId: string,
    message: ChatMessage,
  ): void {
    const dateKey = selectedDate.value;
    addSessionMessage(sessionId, dateKey, message);
    void ChatHistoryCache.merge(sessionId, principalId, [
      toHistoryItem(message),
    ]);
    void ImConfigCache.setLastMessageId(sessionId, principalId, message.id);
  }

  /**
   * @title 同步会话游标（chat_session_members）
   * @description 读取服务器端成员游标并更新本地已读时间，用于正确计算未读量。
   * @keywords-cn 未读量, 成员游标, 同步
   * @keywords-en unread-count, member-cursor, sync
   */
  async function syncReadCursorForSessions(
    sessionIds: string[],
    principalId?: string,
  ): Promise<void> {
    const pid = principalId || getCurrentPrincipalId();
    if (!pid) return;
    for (const sid of sessionIds) {
      try {
        const resp = await imApi.getMembers(sid);
        const list = resp && resp.data ? resp.data : [];
        const self = list.find((m) => m.principalId === pid);
        const last =
          self && typeof self.lastReadAt === 'string' ? self.lastReadAt : null;
        if (last) setThreadReadCursor(sid, last);
      } catch {
        // ignore single-session failure
      }
    }
  }

  return {
    selectedDate,
    chatClientId,
    currentSessionId,
    currentSessionTitle,
    threadReadAt,
    chatHistoryTable,
    setSelectedDate,
    setCurrentSession,
    markThreadRead,
    setThreadReadCursor,
    getSessionMessages,
    setSessionMessages,
    addSessionMessage,
    updateSessionMessage,
    replaceSessionMessage,
    removeSessionMessage,
    fetchSessionMessages,
    syncSession,
    appendLocalMessage,
    syncReadCursorForSessions,
  };
});
