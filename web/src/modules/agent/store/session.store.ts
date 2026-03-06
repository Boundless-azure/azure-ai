/**
 * @title Agent Session Store
 * @description 聊天会话列表状态与前端表管理（含最近消息预览）。
 * @keywords-cn 会话列表, 最近消息, 状态管理
 * @keywords-en session-list, last-message, state-management
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { SessionListItem } from '../types/agent.types';
import { useImStore } from '../../im/im.module';
import type { ImSessionSummary } from '../../../api/im';

export const useAgentSessionStore = defineStore('agent_sessions', () => {
  const realtimePrincipalId = ref<string | null>(null);
  const realtimeConnected = ref(false);
  const imStore = useImStore();

  const sessions = computed<SessionListItem[]>(() => {
    const principal = getCurrentPrincipalInfo();
    const list = Array.isArray(imStore.sessions) ? imStore.sessions : [];
    return list.map((s) => mapImSessionToListItem(s, principal));
  });

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

  const trimToNull = (avatarUrl: string | null | undefined): string | null => {
    const raw = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
    return raw ? raw : null;
  };

  const mergeAvatarUrl = (
    incoming: string | null | undefined,
    existing: string | null | undefined,
  ): string | null => {
    if (incoming === undefined) return trimToNull(existing);
    return trimToNull(incoming);
  };

  function mapImSessionToListItem(
    s: ImSessionSummary,
    principal: { id?: string; displayName?: string },
  ): SessionListItem {
    const selfId = principal.id;
    const selfName = principal.displayName;

    const nextMembers = Array.isArray(s.members)
      ? Array.from(
          new Set(
            s.members
              .map((m) => (m?.principalId ? m.principalId.trim() : ''))
              .filter(Boolean),
          ),
        )
      : undefined;

    const isAzureFixedPrivate =
      s.type === 'private' && !!nextMembers?.includes('azure-ai');
    const isSystemFixedPrivate =
      s.type === 'private' && !!nextMembers?.includes('ai-notify');

    let threadType: SessionListItem['threadType'] = 'group';
    let isAiInvolved = false;
    let isFixedEntry = false;
    if (s.sessionId === 'azure-ai' || isAzureFixedPrivate) {
      threadType = 'assistant';
      isAiInvolved = true;
      isFixedEntry = true;
    } else if (
      s.sessionId === 'ai-notify' ||
      s.type === 'channel' ||
      isSystemFixedPrivate
    ) {
      threadType = 'system';
      isFixedEntry = true;
    } else if (s.type === 'private') {
      threadType = 'dm';
    } else {
      threadType = 'group';
    }

    let title = s.name || null;
    if (s.type === 'private') {
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

    return {
      id: s.sessionId,
      title,
      chatClientId: null,
      threadType,
      isPinned: !!s.isPinned,
      isFixedEntry,
      isAiInvolved,
      unreadCount: typeof s.unreadCount === 'number' ? s.unreadCount : 0,
      lastMessage: s.lastMessagePreview || undefined,
      avatarUrl: mergeAvatarUrl(s.avatarUrl, null),
      createdAt: s.createdAt,
      updatedAt: s.lastMessageAt || s.createdAt,
      members: nextMembers ?? [],
    };
  }

  async function ensureFixedEntrySession(
    fixedId: 'azure-ai' | 'ai-notify',
    title?: string,
  ): Promise<string> {
    try {
      return await imStore.ensureFixedEntrySession(fixedId, title);
    } catch {
      return fixedId;
    }
  }

  async function loadSessions(options?: {
    onlyAi?: boolean;
    searchQuery?: string;
  }) {
    try {
      void options;
      await imStore.ensureCursorsHydrated();
      if (sessions.value.length === 0) {
        await imStore.loadSessionsInitial(100);
        return;
      }
      await imStore.pullSessionsIncremental(100);
    } catch {
      return;
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

  function connectRealtime() {
    const principalId = getCurrentPrincipalId();
    if (
      realtimeConnected.value &&
      realtimePrincipalId.value === (principalId || null)
    ) {
      return;
    }
    realtimePrincipalId.value = principalId || null;
    imStore.connectRealtime();
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
    getSession,
    loadSessions,
    ensureFixedEntrySession,
    connectRealtime,
    disconnectRealtime,
  };
});
