/**
 * @title useImChat
 * @description Vue composable for IM chat functionality backed by Pinia store.
 * @keywords-cn IM聊天, 组合函数, Pinia, 增量拉取
 * @keywords-en im-chat, composable, pinia, incremental-pull
 */

import { onUnmounted, computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { imApi } from '../../../api/im';
import { imSocketService } from '../services/im.socket.service';
import { useImStore } from '../store/im.store';
import type {
  CreateSessionRequest,
  SendMessageRequest,
  AddMemberRequest,
} from '../types/im.types';

export function useImChat() {
  const store = useImStore();
  const {
    sessions,
    activeSession,
    activeMessages,
    activeLoadingMessages,
    activeSendStatusByMessageId,
    connected,
    error,
    loadingSessions,
    activeSessionId,
  } = storeToRefs(store);

  const loading = computed(() => loadingSessions.value);

  const typingUsers = ref<Set<string>>(new Set());
  const aiStreaming = computed(() => false);
  const aiStreamContent = computed(() => '');

  // Connect to WebSocket
  function connect() {
    store.connectRealtime({
      onTyping: (userId, isTyping, sessionId) => {
        if (activeSessionId.value !== sessionId) return;
        const next = new Set(typingUsers.value);
        if (isTyping) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        typingUsers.value = next;
      },
    });
  }

  // Disconnect from WebSocket
  function disconnect() {
    store.disconnectRealtime();
  }

  // Load sessions
  async function loadSessions() {
    await store.loadSessionsInitial(100);
  }

  // Join a session
  async function joinSession(sessionId: string) {
    await store.openSession(sessionId);
  }

  // Leave current session
  function leaveSession() {
    store.leaveSession();
  }

  // Send message
  function sendMessage(
    content: string,
    options?: Omit<SendMessageRequest, 'content'>,
  ) {
    const sid = activeSessionId.value;
    if (!sid) {
      throw new Error('No active session');
    }
    return store.sendMessageOptimistic(sid, content, options);
  }

  // Send typing status
  function sendTyping(isTyping: boolean) {
    const sid = activeSessionId.value;
    if (!sid) return;
    imSocketService.sendTyping(sid, isTyping);
  }

  // Mark message as read
  function markAsRead(_messageId: string) {
    const sid = activeSessionId.value;
    if (!sid) return;
  }

  // Create new session
  async function createSession(request: CreateSessionRequest) {
    const response = await imApi.createSession(request);
    await store.pullSessionsIncremental(100);
    return response.data;
  }

  // Add member to current session
  async function addMember(request: AddMemberRequest) {
    const sid = activeSessionId.value;
    if (!sid) {
      return;
    }
    const response = await imApi.addMember(sid, request);
    await store.refreshSessionMembers(sid);
    return response.data;
  }

  // Load more messages
  async function loadMoreMessages() {
    const sid = activeSessionId.value;
    if (!sid) return;
    await store.loadOlderMessages(sid, 50);
  }

  // Computed
  const isTyping = computed(() => typingUsers.value.size > 0);
  const typingUsersList = computed(() => Array.from(typingUsers.value));

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect();
  });

  return {
    // State
    sessions,
    currentSession: activeSession,
    messages: activeMessages,
    loading,
    loadingMessages: activeLoadingMessages,
    error,
    connected,
    sendStatusByMessageId: activeSendStatusByMessageId,
    aiStreaming,
    aiStreamContent,
    isTyping,
    typingUsersList,
    // Actions
    connect,
    disconnect,
    loadSessions,
    joinSession,
    leaveSession,
    sendMessage,
    sendTyping,
    markAsRead,
    createSession,
    addMember,
    loadMoreMessages,
  };
}
