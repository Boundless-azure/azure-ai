/**
 * @title Agent Session Store
 * @description 聊天会话列表状态与前端表管理（含最近消息预览）。
 * @keywords-cn 会话列表, 最近消息, 状态管理
 * @keywords-en session-list, last-message, state-management
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SessionListItem } from '../types/agent.types';
import { imApi } from '../../../api/im';
import { useImStore } from '../../im/im.module';
import { useAgentStore } from './agent.store';
import { usePanelStore } from './panel.store';
import { storeToRefs } from 'pinia';
import { ChatRole } from '../enums/agent.enums';

export const useAgentSessionStore = defineStore('agent_sessions', () => {
  const sessions = ref<SessionListItem[]>([]);
  const realtimePrincipalId = ref<string | null>(null);
  const realtimeConnected = ref(false);
  const imStore = useImStore();
  const DB_NAME = 'agent_sessions';
  const STORE_NAME = 'sessions';
  const DB_VERSION = 2;
  const SESSIONS_KEY = 'agent.sessions';

  type SessionsRecord = {
    key: string;
    items: SessionListItem[];
    updatedAt: number;
  };

  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function runInStore<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T | undefined> {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, mode);
          const store = tx.objectStore(STORE_NAME);
          let result: T | undefined;
          let request: IDBRequest<T> | undefined;
          try {
            request = action(store);
            request.onsuccess = () => {
              result = request?.result;
            };
          } catch (e) {
            db.close();
            const err = e instanceof Error ? e : new Error(String(e));
            reject(err);
            return;
          }
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onerror = () => {
            const rawErr = tx.error || request?.error;
            const err =
              rawErr instanceof Error ? rawErr : new Error(String(rawErr));
            db.close();
            reject(err);
          };
          tx.onabort = () => {
            const rawErr = tx.error || request?.error;
            const err =
              rawErr instanceof Error ? rawErr : new Error(String(rawErr));
            db.close();
            reject(err);
          };
        }),
      (err) =>
        Promise.reject(err instanceof Error ? err : new Error(String(err))),
    );
  }

  async function loadCachedSessions(): Promise<SessionListItem[]> {
    try {
      const rec = await runInStore<SessionsRecord>(
        'readonly',
        (store) => store.get(SESSIONS_KEY) as IDBRequest<SessionsRecord>,
      );
      const items = rec?.items;
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  async function saveCachedSessions(items: SessionListItem[]): Promise<void> {
    const record: SessionsRecord = {
      key: SESSIONS_KEY,
      items,
      updatedAt: Date.now(),
    };
    try {
      await runInStore('readwrite', (store) => store.put(record));
    } catch (e) {
      void e;
    }
  }

  void loadCachedSessions().then((items) => {
    if (items.length > 0) setSessions(items);
  });

  function setSessions(items: SessionListItem[]) {
    const map = new Map<string, SessionListItem>();
    for (const it of items) {
      map.set(it.id, it);
    }
    sessions.value = Array.from(map.values());
  }

  function upsertSession(item: SessionListItem) {
    const index = sessions.value.findIndex((s) => s.id === item.id);
    if (index === -1) {
      sessions.value.push(item);
    } else {
      sessions.value[index] = item;
    }
  }

  function updateSession(id: string, patch: Partial<SessionListItem>) {
    const index = sessions.value.findIndex((s) => s.id === id);
    if (index === -1) return;
    sessions.value[index] = { ...sessions.value[index], ...patch };
  }

  function updateSessionLastMessage(
    id: string,
    content: string,
    timestampIso: string,
  ) {
    updateSession(id, {
      lastMessage: content,
      updatedAt: timestampIso,
    });
  }

  function removeSession(id: string) {
    const index = sessions.value.findIndex((s) => s.id === id);
    if (index === -1) return;
    sessions.value.splice(index, 1);
  }

  function getSession(id: string | undefined): SessionListItem | undefined {
    if (!id) return undefined;
    return sessions.value.find((s) => s.id === id);
  }

  function getCurrentPrincipalInfo(): {
    id?: string;
    displayName?: string;
  } {
    try {
      const principalRaw = localStorage.getItem('principal');
      if (principalRaw) {
        const parsed = JSON.parse(principalRaw) as {
          id?: string;
          displayName?: string;
        };
        const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
        const displayName =
          typeof parsed.displayName === 'string'
            ? parsed.displayName.trim()
            : '';
        return {
          id: id || undefined,
          displayName: displayName || undefined,
        };
      }
      const legacy = localStorage.getItem('identity.currentPrincipalId');
      const id = (legacy || '').trim();
      return { id: id || undefined };
    } catch {
      return {};
    }
  }

  // 移除本地自管的 sessionsCursor，统一由 IM 模块维护

  function mapImSessionToListItem(
    s: import('../../../api/im').ImSessionSummary,
    principal: { id?: string; displayName?: string },
    existing?: SessionListItem,
  ): SessionListItem {
    const selfId = principal.id;
    const selfName = principal.displayName;

    let threadType: SessionListItem['threadType'] = 'group';
    let isAiInvolved = false;
    let isFixedEntry = false;
    if (s.sessionId === 'azure-ai') {
      threadType = 'assistant';
      isAiInvolved = true;
      isFixedEntry = true;
    } else if (s.sessionId === 'ai-notify' || s.type === 'channel') {
      threadType = 'system';
      isFixedEntry = true;
    } else if (s.type === 'private') {
      threadType = 'dm';
    } else {
      threadType = 'group';
    }

    let title = s.name || null;
    if (s.type === 'private' && !isFixedEntry) {
      const nameTrimmed = title ? title.trim() : '';
      const shouldResolve =
        !nameTrimmed || (!!selfName && nameTrimmed === selfName);
      if (shouldResolve) {
        const members = Array.isArray(s.members) ? s.members : [];
        let other = members.find((m) =>
          selfId ? m.principalId !== selfId : false,
        );
        if (!other && selfName) {
          other = members.find(
            (m) => !!m.displayName && m.displayName !== selfName,
          );
        }
        if (!other && members.length > 0) {
          other = members[0];
        }
        title = other?.displayName || title;
      }
    }

    const existingUnread =
      existing && typeof existing.unreadCount === 'number'
        ? existing.unreadCount
        : undefined;

    return {
      id: s.sessionId,
      title,
      chatClientId: existing?.chatClientId ?? null,
      threadType,
      isPinned: existing?.isPinned ?? false,
      isFixedEntry,
      isAiInvolved,
      unreadCount:
        typeof s.unreadCount === 'number' ? s.unreadCount : existingUnread,
      lastMessage: s.lastMessagePreview || existing?.lastMessage,
      avatarUrl: s.avatarUrl || existing?.avatarUrl || null,
      createdAt: s.createdAt,
      updatedAt: s.lastMessageAt || s.createdAt,
      members: existing?.members ?? [],
    };
  }

  async function loadSessions(options?: {
    onlyAi?: boolean;
    searchQuery?: string;
  }) {
    try {
      void options;
      const principal = getCurrentPrincipalInfo();

      await imStore.ensureCursorsHydrated(principal.id);

      const hasLocal = sessions.value.length > 0;
      const cursor = imStore.sessionsCursor;

      if (hasLocal && cursor) {
        const updates = await imStore.pullSessionsIncremental(100);
        if (updates.length > 0) {
          const map = new Map(sessions.value.map((s) => [s.id, s]));
          for (const u of updates) {
            const prev = map.get(u.sessionId);
            map.set(u.sessionId, mapImSessionToListItem(u, principal, prev));
          }
          const merged = Array.from(map.values());
          setSessions(merged);
          await saveCachedSessions(merged);
        }
        return;
      }

      await imStore.loadSessionsInitial(100);
      const mapped: SessionListItem[] = (imStore.sessions || []).map((s) =>
        mapImSessionToListItem(s, principal),
      );

      setSessions(mapped);
      await saveCachedSessions(mapped);
    } catch {
      const cached = await loadCachedSessions();
      setSessions(cached);
    }
  }

  function getCurrentPrincipalId(): string | undefined {
    try {
      const principalRaw = localStorage.getItem('principal');
      if (principalRaw) {
        const parsed = JSON.parse(principalRaw) as { id?: string };
        const pid = typeof parsed.id === 'string' ? parsed.id.trim() : '';
        if (pid) return pid;
      }
      const legacy = localStorage.getItem('identity.currentPrincipalId');
      const id = (legacy || '').trim();
      return id || undefined;
    } catch {
      return undefined;
    }
  }

  async function handleIncomingMessage(
    message: import('../../../api/im').ImMessageInfo,
    sessionId: string,
  ) {
    const agentStore = useAgentStore();
    const panelStore = usePanelStore();
    const { currentSessionId, selectedDate } = storeToRefs(agentStore);
    const { mode } = storeToRefs(panelStore);
    const selfId = getCurrentPrincipalId();
    const senderId = message.senderId ? message.senderId.trim() : undefined;
    const isSelf = !!selfId && !!senderId && senderId === selfId;
    const isActive =
      mode.value === 'chat' && currentSessionId.value === sessionId;
    const shouldIncrement = !isSelf && !isActive;
    const messageTime = new Date(message.createdAt).toISOString();
    const existing = getSession(sessionId);
    if (existing) {
      const currentUnread =
        typeof existing.unreadCount === 'number' ? existing.unreadCount : 0;
      const nextUnread = shouldIncrement
        ? currentUnread + 1
        : isActive || isSelf
          ? 0
          : existing.unreadCount;
      updateSession(sessionId, {
        lastMessage: message.content,
        updatedAt: messageTime,
        unreadCount: nextUnread,
      });
    } else {
      try {
        const detailResp = await imApi.getSession(sessionId);
        const s = detailResp.data;
        let threadType: SessionListItem['threadType'] = 'group';
        let isAiInvolved = false;
        let isFixedEntry = false;
        if (s.sessionId === 'azure-ai') {
          threadType = 'assistant';
          isAiInvolved = true;
          isFixedEntry = true;
        } else if (s.sessionId === 'ai-notify' || s.type === 'channel') {
          threadType = 'system';
          isFixedEntry = true;
        } else if (s.type === 'private') {
          threadType = 'dm';
        } else {
          threadType = 'group';
        }
        upsertSession({
          id: sessionId,
          title: s.name || null,
          chatClientId: null,
          threadType,
          isPinned: false,
          isFixedEntry,
          isAiInvolved,
          unreadCount: shouldIncrement ? 1 : 0,
          lastMessage: message.content || s.lastMessagePreview || undefined,
          avatarUrl: s.avatarUrl || null,
          createdAt: s.createdAt,
          updatedAt: messageTime,
          members: [],
        });
      } catch {
        upsertSession({
          id: sessionId,
          title: message.senderName || '新会话',
          chatClientId: null,
          threadType: 'group',
          isPinned: false,
          isAiInvolved: false,
          lastMessage: message.content,
          createdAt: messageTime,
          updatedAt: messageTime,
          unreadCount: shouldIncrement ? 1 : 0,
          members: [],
        });
      }
    }

    if (isActive) {
      const todayKey = selectedDate.value;
      const existingMsg = agentStore
        .getSessionMessages(sessionId, todayKey)
        .find((m) => m.id === message.id);
      if (!existingMsg) {
        agentStore.appendLocalMessage(sessionId, selfId || '', {
          id: message.id,
          role: isSelf ? ChatRole.User : ChatRole.Assistant,
          content: message.content,
          timestamp: new Date(message.createdAt).getTime(),
          tool_calls: [],
          senderId: senderId,
          senderName: message.senderName,
        });
      }
      updateSession(sessionId, { unreadCount: 0 });
    }
  }

  function connectRealtime() {
    const principalId = getCurrentPrincipalId();
    if (
      realtimeConnected.value &&
      realtimePrincipalId.value === (principalId || null)
    ) {
      return;
    }
    realtimePrincipalId.value = principalId || null;
    imStore.connectRealtime({
      onNewMessageBeacon: ({ sessionId }) => {
        const panelStore = usePanelStore();
        panelStore.triggerSessionRefresh();

        const agentStore = useAgentStore();
        const { currentSessionId } = storeToRefs(agentStore);
        if (currentSessionId.value === sessionId) {
          void agentStore.syncSession(sessionId, principalId || undefined);
        }
      },
      onMemberJoined: () => {
        const panelStore = usePanelStore();
        panelStore.triggerSessionRefresh();
      },
      onMemberLeft: () => {
        const panelStore = usePanelStore();
        panelStore.triggerSessionRefresh();
      },
      onUserPush: (data) => {
        console.log('[AgentSessionStore] onUserPush', data);
        if (data.sessionId) {
          const panelStore = usePanelStore();
          panelStore.triggerSessionRefresh();
        }
      },
    });
    realtimeConnected.value = true;
  }

  function disconnectRealtime() {
    if (!realtimeConnected.value) return;
    imStore.disconnectRealtime();
    realtimeConnected.value = false;
    realtimePrincipalId.value = null;
  }

  return {
    sessions,
    setSessions,
    upsertSession,
    updateSession,
    updateSessionLastMessage,
    removeSession,
    getSession,
    loadSessions,
    connectRealtime,
    disconnectRealtime,
    handleIncomingMessage,
  };
});
