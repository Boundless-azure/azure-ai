/**
 * @title IM Store
 * @description IM 数据与增量拉取统一管理：会话列表游标、单会话消息游标、信标触发增量。
 * @keywords-cn Pinia, IM, 增量拉取, 游标, last_message_id, new_message
 * @keywords-en pinia, im, incremental-pull, cursor, last_message_id, new_message
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  imApi,
  type ImMessageInfo,
  type ImSessionDetail,
  type ImSessionSummary,
} from '../../../api/im';
import type { ImSocketCallbacks } from '../services/im.socket.service';
import { imSocketService } from '../services/im.socket.service';

export const useImStore = defineStore('im', () => {
  const connected = ref(false);
  const principalId = ref<string | null>(null);

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  type SendStatus = 'sending' | 'sent' | 'error';

  type PrincipalState = {
    sessions: ImSessionSummary[];
    sessionsCursor: string | null;
    sessionDetails: Record<string, ImSessionDetail | undefined>;
    activeSessionId: string | null;
    messagesBySession: Record<string, ImMessageInfo[] | undefined>;
    messageCursors: Record<string, string | null | undefined>;
    sendStatusByMessageId: Record<string, SendStatus | undefined>;
    loadingSessions: boolean;
    lastSessionsFetchAt: number | null;
    loadingMessages: Record<string, boolean | undefined>;
    error: string | null;
  };

  const stateByPrincipal = ref<Record<string, PrincipalState>>({});

  let userNotifyTimeout: number | null = null;

  const pullTimeoutBySession = new Map<string, number>();
  const pullLastAtBySession = new Map<string, number>();

  const hydratingCursors = ref(false);
  const hydratedCursorPids = new Set<string>();
  const hydratePromiseByPid = new Map<string, Promise<void>>();
  const STORAGE_KEY_PREFIX = 'im.cursors';
  const DB_NAME = 'im_store';
  const CURSORS_STORE_NAME = 'cursors';
  const MESSAGES_STORE_NAME = 'messages';
  const DB_VERSION = 2;

  type ImCursorRecord = {
    key: string;
    sessionsCursor: string | null;
    messageCursors: Record<string, string | null | undefined>;
    updatedAt: number;
  };

  type ImMessagesRecord = {
    key: string;
    items: ImMessageInfo[];
    updatedAt: number;
  };

  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CURSORS_STORE_NAME)) {
          db.createObjectStore(CURSORS_STORE_NAME, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(MESSAGES_STORE_NAME)) {
          db.createObjectStore(MESSAGES_STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function runInStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T | undefined> {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, mode);
          const store = tx.objectStore(storeName);
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

  function runInCursorsStore<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T | undefined> {
    return runInStore(CURSORS_STORE_NAME, mode, action);
  }

  function runInMessagesStore<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T | undefined> {
    return runInStore(MESSAGES_STORE_NAME, mode, action);
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

  function getCurrentPrincipalDisplayName(): string | undefined {
    try {
      const principalRaw = localStorage.getItem('principal');
      if (principalRaw) {
        const parsed = JSON.parse(principalRaw) as { displayName?: string };
        const name =
          typeof parsed.displayName === 'string'
            ? parsed.displayName.trim()
            : '';
        return name || undefined;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  function buildInitialState(): PrincipalState {
    return {
      sessions: [],
      sessionsCursor: null,
      sessionDetails: {},
      activeSessionId: null,
      messagesBySession: {},
      messageCursors: {},
      sendStatusByMessageId: {},
      loadingSessions: false,
      lastSessionsFetchAt: null,
      loadingMessages: {},
      error: null,
    };
  }

  function ensurePrincipalState(pid: string): PrincipalState {
    const existing = stateByPrincipal.value[pid];
    if (existing) return existing;
    const next = buildInitialState();
    stateByPrincipal.value = { ...stateByPrincipal.value, [pid]: next };
    return next;
  }

  function updatePrincipalState(pid: string, patch: Partial<PrincipalState>) {
    const prev = ensurePrincipalState(pid);
    stateByPrincipal.value = {
      ...stateByPrincipal.value,
      [pid]: { ...prev, ...patch },
    };
  }

  function getActivePid(): string | undefined {
    const pid = (principalId.value || getCurrentPrincipalId() || '').trim();
    return pid || undefined;
  }

  function getCursorStorageKey(pid: string): string {
    return `${STORAGE_KEY_PREFIX}:${pid}`;
  }

  function getMessagesStorageKey(pid: string, sessionId: string): string {
    return `im.messages:${pid}:${sessionId}`;
  }

  function sortMessages(list: ImMessageInfo[]): ImMessageInfo[] {
    const merged = [...list];
    merged.sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      if (at !== bt) return at - bt;
      return a.id.localeCompare(b.id);
    });
    return merged;
  }

  function takeLatestMessages(
    list: ImMessageInfo[],
    max = 50,
  ): ImMessageInfo[] {
    const sorted = sortMessages(list);
    if (sorted.length <= max) return sorted;
    return sorted.slice(sorted.length - max);
  }

  async function hydrateMessages(pid: string, sessionId: string) {
    try {
      const key = getMessagesStorageKey(pid, sessionId);
      const rec = await runInMessagesStore<ImMessagesRecord>(
        'readonly',
        (store) => store.get(key) as IDBRequest<ImMessagesRecord>,
      );
      if (!rec || !Array.isArray(rec.items)) return;
      const state = ensurePrincipalState(pid);
      if (state.messagesBySession[sessionId]) return;
      updatePrincipalState(pid, {
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: takeLatestMessages(rec.items, 50),
        },
      });
    } catch {
      return;
    }
  }

  async function persistMessages(pid: string, sessionId: string) {
    const state = ensurePrincipalState(pid);
    const existing = state.messagesBySession[sessionId] ?? [];
    const key = getMessagesStorageKey(pid, sessionId);
    const record: ImMessagesRecord = {
      key,
      items: takeLatestMessages(existing, 50),
      updatedAt: Date.now(),
    };
    try {
      await runInMessagesStore('readwrite', (store) => store.put(record));
    } catch {
      return;
    }
  }

  async function hydrateCursors(pid: string) {
    hydratingCursors.value = true;
    try {
      const key = getCursorStorageKey(pid);
      const rec = await runInCursorsStore<ImCursorRecord>(
        'readonly',
        (store) => store.get(key) as IDBRequest<ImCursorRecord>,
      );
      if (rec) {
        const nextSessionsCursor =
          typeof rec.sessionsCursor === 'string' || rec.sessionsCursor === null
            ? (rec.sessionsCursor ?? null)
            : null;
        const nextMessageCursors =
          rec.messageCursors && typeof rec.messageCursors === 'object'
            ? { ...rec.messageCursors }
            : {};
        updatePrincipalState(pid, {
          sessionsCursor: nextSessionsCursor,
          messageCursors: nextMessageCursors,
        });
        return;
      }
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        sessionsCursor?: string | null;
        messageCursors?: Record<string, string | null | undefined>;
      };
      const sc =
        typeof parsed.sessionsCursor === 'string' ||
        parsed.sessionsCursor === null
          ? (parsed.sessionsCursor ?? null)
          : null;
      const mc =
        parsed.messageCursors && typeof parsed.messageCursors === 'object'
          ? { ...parsed.messageCursors }
          : {};
      updatePrincipalState(pid, { sessionsCursor: sc, messageCursors: mc });
      const record: ImCursorRecord = {
        key,
        sessionsCursor: sc,
        messageCursors: mc,
        updatedAt: Date.now(),
      };
      try {
        await runInCursorsStore('readwrite', (store) => store.put(record));
        localStorage.removeItem(key);
      } catch {
        void 0;
      }
    } catch {
      return;
    } finally {
      hydratingCursors.value = false;
    }
  }

  async function ensureCursorsHydrated(pid?: string) {
    const targetPid = (pid || getActivePid() || '').trim();
    if (!targetPid) return;
    if (hydratedCursorPids.has(targetPid)) return;

    const existing = hydratePromiseByPid.get(targetPid);
    if (existing) {
      await existing;
      return;
    }

    const p = hydrateCursors(targetPid)
      .then(() => {
        hydratedCursorPids.add(targetPid);
      })
      .finally(() => {
        hydratePromiseByPid.delete(targetPid);
      });
    hydratePromiseByPid.set(targetPid, p);
    await p;
  }

  async function persistCursors(pid: string) {
    if (hydratingCursors.value) return;
    const state = ensurePrincipalState(pid);
    const key = getCursorStorageKey(pid);
    const record: ImCursorRecord = {
      key,
      sessionsCursor: state.sessionsCursor,
      messageCursors: state.messageCursors,
      updatedAt: Date.now(),
    };
    try {
      await runInCursorsStore('readwrite', (store) => store.put(record));
    } catch {
      return;
    }
  }

  const bootstrapPid = getCurrentPrincipalId();
  if (bootstrapPid) {
    void hydrateCursors(bootstrapPid);
  }

  const sessions = computed<ImSessionSummary[]>(() => {
    const pid = getActivePid();
    if (!pid) return [];
    return ensurePrincipalState(pid).sessions;
  });

  const sessionsCursor = computed<string | null>(() => {
    const pid = getActivePid();
    if (!pid) return null;
    return ensurePrincipalState(pid).sessionsCursor;
  });

  const loadingSessions = computed<boolean>(() => {
    const pid = getActivePid();
    if (!pid) return false;
    return ensurePrincipalState(pid).loadingSessions;
  });

  const error = computed<string | null>(() => {
    const pid = getActivePid();
    if (!pid) return null;
    return ensurePrincipalState(pid).error;
  });

  const activeSessionId = computed<string | null>({
    get() {
      const pid = getActivePid();
      if (!pid) return null;
      return ensurePrincipalState(pid).activeSessionId;
    },
    set(v) {
      const pid = getActivePid();
      if (!pid) return;
      updatePrincipalState(pid, { activeSessionId: v ?? null });
    },
  });

  const activeSession = computed(() => {
    const pid = getActivePid();
    const sid = activeSessionId.value;
    if (!pid || !sid) return null;
    return ensurePrincipalState(pid).sessionDetails[sid] ?? null;
  });

  const activeMessages = computed(() => {
    const pid = getActivePid();
    const sid = activeSessionId.value;
    if (!pid || !sid) return [];
    return ensurePrincipalState(pid).messagesBySession[sid] ?? [];
  });

  const activeLoadingMessages = computed<boolean>(() => {
    const pid = getActivePid();
    const sid = activeSessionId.value;
    if (!pid || !sid) return false;
    return !!ensurePrincipalState(pid).loadingMessages[sid];
  });

  const activeSendStatusByMessageId = computed<
    Record<string, SendStatus | undefined>
  >(() => {
    const pid = getActivePid();
    if (!pid) return {};
    return ensurePrincipalState(pid).sendStatusByMessageId;
  });

  function sortSessions(list: ImSessionSummary[]): ImSessionSummary[] {
    const cloned = [...list];
    cloned.sort((a, b) => {
      const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bt - at;
    });
    return cloned;
  }

  function isUuid(value: string): boolean {
    return UUID_RE.test(value);
  }

  function mergeSessions(pid: string, updates: ImSessionSummary[]) {
    const state = ensurePrincipalState(pid);
    const map = new Map(state.sessions.map((s) => [s.sessionId, s]));
    for (const s of updates) {
      map.set(s.sessionId, s);
    }
    updatePrincipalState(pid, {
      sessions: sortSessions([...map.values()]),
    });
  }

  function mergeMessages(
    pid: string,
    sessionId: string,
    updates: ImMessageInfo[],
  ) {
    const state = ensurePrincipalState(pid);
    const existing = state.messagesBySession[sessionId] ?? [];
    const map = new Map(existing.map((m) => [m.id, m]));
    for (const m of updates) {
      map.set(m.id, m);
    }
    const merged = sortMessages([...map.values()]);
    updatePrincipalState(pid, {
      messagesBySession: { ...state.messagesBySession, [sessionId]: merged },
    });
  }

  async function mergeMessagesIncremental(
    pid: string,
    sessionId: string,
    updates: ImMessageInfo[],
    max = 50,
  ) {
    mergeMessages(pid, sessionId, updates);
    const state = ensurePrincipalState(pid);
    const existing = state.messagesBySession[sessionId] ?? [];
    updatePrincipalState(pid, {
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: takeLatestMessages(existing, max),
      },
    });
    await persistMessages(pid, sessionId);
  }

  async function loadSessionsInitial(limit = 100): Promise<ImSessionSummary[]> {
    const pid = getActivePid();
    if (!pid) return [];
    const state = ensurePrincipalState(pid);
    if (state.loadingSessions) return [];
    updatePrincipalState(pid, {
      loadingSessions: true,
      lastSessionsFetchAt: Date.now(),
      error: null,
    });
    try {
      const resp = await imApi.getSessions({ limit });

      const respItems = resp.data.items ?? [];
      const nextSessions = sortSessions(respItems);
      const nextCursor = resp.data.cursor ?? null;
      updatePrincipalState(pid, {
        sessions: nextSessions,
        sessionsCursor: nextCursor,
      });
      await persistCursors(pid);
      return respItems;
    } catch (e) {
      updatePrincipalState(pid, {
        error: e instanceof Error ? e.message : String(e),
      });
      return [];
    } finally {
      const cur = ensurePrincipalState(pid);
      updatePrincipalState(pid, { loadingSessions: false, error: cur.error });
    }
  }

  async function pullSessionsIncremental(
    limit = 100,
  ): Promise<ImSessionSummary[]> {
    const pid = getActivePid();
    if (!pid) return [];
    const state = ensurePrincipalState(pid);
    if (!state.sessionsCursor) {
      return await loadSessionsInitial(limit);
    }
    if (state.loadingSessions) return [];
    updatePrincipalState(pid, {
      loadingSessions: true,
      lastSessionsFetchAt: Date.now(),
    });
    try {
      const resp = await imApi.getSessions({
        limit,
        last_message_id: state.sessionsCursor,
      });
      const items = resp.data.items ?? [];
      mergeSessions(pid, items);
      updatePrincipalState(pid, {
        sessionsCursor:
          resp.data.cursor ?? ensurePrincipalState(pid).sessionsCursor,
      });
      await persistCursors(pid);
      return items;
    } catch (e) {
      updatePrincipalState(pid, {
        error: e instanceof Error ? e.message : String(e),
      });
      return [];
    } finally {
      updatePrincipalState(pid, { loadingSessions: false });
    }
  }

  async function loadSessionDetail(sessionId: string) {
    const pid = getActivePid();
    if (!pid) return null;
    const state = ensurePrincipalState(pid);
    const existing = state.sessionDetails[sessionId];
    if (existing) return existing;

    const fromList = state.sessions.find((s) => s.sessionId === sessionId);
    if (fromList) {
      const nextDetail: ImSessionDetail = {
        ...fromList,
        lastMessageId: null,
        memberLastMessageId: null,
        lastMessage: null,
        lastMessagePreview: null,
        description: null,
        creatorId: null,
        members: fromList.members,
      };
      updatePrincipalState(pid, {
        sessionDetails: { ...state.sessionDetails, [sessionId]: nextDetail },
      });
      return nextDetail;
    }

    const resp = await imApi.getSession(sessionId);
    updatePrincipalState(pid, {
      sessionDetails: {
        ...ensurePrincipalState(pid).sessionDetails,
        [sessionId]: resp.data,
      },
    });
    return resp.data;
  }

  async function refreshSessionMembers(sessionId: string) {
    const pid = getActivePid();
    if (!pid) return;
    const resp = await imApi.getMembers(sessionId);
    const members = resp.data ?? [];

    const state = ensurePrincipalState(pid);
    const nextSessions = state.sessions.map((s) =>
      s.sessionId === sessionId ? { ...s, members } : s,
    );

    const existingDetail = state.sessionDetails[sessionId];
    if (existingDetail) {
      updatePrincipalState(pid, {
        sessions: nextSessions,
        sessionDetails: {
          ...state.sessionDetails,
          [sessionId]: { ...existingDetail, members },
        },
      });
    } else {
      updatePrincipalState(pid, { sessions: nextSessions });
    }
  }

  async function loadMessagesInitial(sessionId: string, limit = 50) {
    const pid = getActivePid();
    if (!pid) return;
    const state = ensurePrincipalState(pid);
    if (state.loadingMessages[sessionId]) return;
    updatePrincipalState(pid, {
      loadingMessages: { ...state.loadingMessages, [sessionId]: true },
      error: null,
    });
    try {
      const resp = await imApi.getMessages(sessionId, { limit });
      const items = takeLatestMessages(resp.data.items ?? [], 50);
      const nextState = ensurePrincipalState(pid);
      updatePrincipalState(pid, {
        messagesBySession: {
          ...nextState.messagesBySession,
          [sessionId]: items,
        },
        messageCursors: {
          ...nextState.messageCursors,
          [sessionId]: resp.data.cursor ?? null,
        },
      });
      await persistCursors(pid);
      await persistMessages(pid, sessionId);
    } catch (e) {
      updatePrincipalState(pid, {
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      const cur = ensurePrincipalState(pid);
      updatePrincipalState(pid, {
        loadingMessages: { ...cur.loadingMessages, [sessionId]: false },
      });
    }
  }

  async function fetchMessagesByLastId(
    sessionId: string,
    limit = 50,
    lastId?: string,
  ): Promise<ImMessageInfo[]> {
    const pid = getActivePid();
    if (!pid) return [];
    const state = ensurePrincipalState(pid);
    if (state.loadingMessages[sessionId]) return [];
    updatePrincipalState(pid, {
      loadingMessages: { ...state.loadingMessages, [sessionId]: true },
      error: null,
    });
    try {
      const resp = await imApi.getMessages(sessionId, {
        limit,
        last_message_id: lastId && isUuid(lastId) ? lastId : undefined,
      });
      const items = resp.data.items ?? [];
      await mergeMessagesIncremental(pid, sessionId, items, 50);
      const nextState = ensurePrincipalState(pid);
      updatePrincipalState(pid, {
        messageCursors: {
          ...nextState.messageCursors,
          [sessionId]:
            resp.data.cursor ?? nextState.messageCursors[sessionId] ?? null,
        },
      });
      await persistCursors(pid);
      return items;
    } catch (e) {
      updatePrincipalState(pid, {
        error: e instanceof Error ? e.message : String(e),
      });
      return [];
    } finally {
      const cur = ensurePrincipalState(pid);
      updatePrincipalState(pid, {
        loadingMessages: { ...cur.loadingMessages, [sessionId]: false },
      });
    }
  }

  async function pullMessagesIncremental(sessionId: string, limit = 100) {
    const pid = getActivePid();
    if (!pid) return;
    const state = ensurePrincipalState(pid);
    const cursor = state.messageCursors[sessionId] ?? null;
    if (!cursor) {
      await loadMessagesInitial(sessionId, limit);
      return;
    }
    if (state.loadingMessages[sessionId]) return;
    updatePrincipalState(pid, {
      loadingMessages: { ...state.loadingMessages, [sessionId]: true },
    });
    try {
      const resp = await imApi.getMessages(sessionId, {
        limit,
        last_message_id: cursor,
      });
      await mergeMessagesIncremental(pid, sessionId, resp.data.items ?? [], 50);
      const nextState = ensurePrincipalState(pid);
      updatePrincipalState(pid, {
        messageCursors: {
          ...nextState.messageCursors,
          [sessionId]: resp.data.cursor ?? cursor,
        },
      });
      await persistCursors(pid);
    } catch (e) {
      updatePrincipalState(pid, {
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      const cur = ensurePrincipalState(pid);
      updatePrincipalState(pid, {
        loadingMessages: { ...cur.loadingMessages, [sessionId]: false },
      });
    }
  }

  async function loadOlderMessages(sessionId: string, limit = 50) {
    const pid = getActivePid();
    if (!pid) return;
    const state = ensurePrincipalState(pid);
    const existing = state.messagesBySession[sessionId] ?? [];
    const oldest = existing.length > 0 ? existing[0] : null;
    if (!oldest) {
      await loadMessagesInitial(sessionId, limit);
      return;
    }
    if (state.loadingMessages[sessionId]) return;
    updatePrincipalState(pid, {
      loadingMessages: { ...state.loadingMessages, [sessionId]: true },
      error: null,
    });
    try {
      const resp = await imApi.getMessages(sessionId, {
        limit,
        before: oldest.id,
      });
      mergeMessages(pid, sessionId, resp.data.items ?? []);
      await persistMessages(pid, sessionId);
      const nextState = ensurePrincipalState(pid);
      const currentCursor = nextState.messageCursors[sessionId] ?? null;
      updatePrincipalState(pid, {
        messageCursors: {
          ...nextState.messageCursors,
          [sessionId]: resp.data.cursor ?? currentCursor,
        },
      });
      await persistCursors(pid);
    } catch (e) {
      updatePrincipalState(pid, {
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      const cur = ensurePrincipalState(pid);
      updatePrincipalState(pid, {
        loadingMessages: { ...cur.loadingMessages, [sessionId]: false },
      });
    }
  }

  async function ensureSelfIsMember(sessionId: string) {
    const pid = getActivePid();
    if (!pid) return;
    try {
      const resp = await imApi.getMembers(sessionId);
      const members = resp.data || [];
      if (!members.find((m) => m.principalId === pid)) {
        await imApi.addMember(sessionId, { principalId: pid });
      }
    } catch {
      return;
    }
  }

  async function openSession(sessionId: string) {
    const pid = getActivePid();
    if (!pid) return;
    await ensureCursorsHydrated(pid);
    const state = ensurePrincipalState(pid);
    if (state.activeSessionId && state.activeSessionId !== sessionId) {
      imSocketService.leaveRoom(state.activeSessionId);
    }

    updatePrincipalState(pid, { activeSessionId: sessionId });
    await ensureSelfIsMember(sessionId);
    await loadSessionDetail(sessionId);
    imSocketService.joinRoom(sessionId);

    await hydrateMessages(pid, sessionId);
    await pullMessagesIncremental(sessionId, 50);
  }

  function leaveSession() {
    const pid = getActivePid();
    if (!pid) return;
    const sid = ensurePrincipalState(pid).activeSessionId;
    if (sid) {
      imSocketService.leaveRoom(sid);
    }
    updatePrincipalState(pid, { activeSessionId: null });
  }

  async function sendMessage(
    sessionId: string,
    content: string,
    options?: {
      messageType?: ImMessageInfo['messageType'];
      replyToId?: string;
      attachments?: ImMessageInfo['attachments'];
    },
  ): Promise<ImMessageInfo> {
    const pid = getActivePid();
    if (!pid) {
      throw new Error('No principal');
    }

    await ensureSelfIsMember(sessionId);

    const resp = await imApi.sendMessage(sessionId, {
      content,
      messageType: options?.messageType,
      replyToId: options?.replyToId,
      attachments: options?.attachments ?? undefined,
    });

    await mergeMessagesIncremental(pid, sessionId, [resp.data], 50);
    const state = ensurePrincipalState(pid);
    updatePrincipalState(pid, {
      sendStatusByMessageId: {
        ...state.sendStatusByMessageId,
        [resp.data.id]: 'sent',
      },
    });

    await pullSessionsIncremental(100);
    return resp.data;
  }

  async function sendMessageOptimistic(
    sessionId: string,
    content: string,
    options?: {
      messageType?: ImMessageInfo['messageType'];
      replyToId?: string;
      attachments?: ImMessageInfo['attachments'];
    },
  ): Promise<ImMessageInfo | null> {
    const pid = getActivePid();
    if (!pid) return null;

    await ensureSelfIsMember(sessionId);

    const senderName = getCurrentPrincipalDisplayName() || '我';
    const tempId = `temp-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const temp: ImMessageInfo = {
      id: tempId,
      sessionId,
      senderId: pid,
      senderName,
      messageType: options?.messageType ?? 'text',
      content,
      replyToId: options?.replyToId ?? null,
      attachments: options?.attachments ?? null,
      isEdited: false,
      createdAt: nowIso,
    };

    await mergeMessagesIncremental(pid, sessionId, [temp], 50);
    const state = ensurePrincipalState(pid);
    updatePrincipalState(pid, {
      sendStatusByMessageId: {
        ...state.sendStatusByMessageId,
        [tempId]: 'sending',
      },
    });

    try {
      const resp = await imApi.sendMessage(sessionId, {
        content,
        messageType: options?.messageType,
        replyToId: options?.replyToId,
        attachments: options?.attachments ?? undefined,
      });

      const nextState = ensurePrincipalState(pid);
      const existing = nextState.messagesBySession[sessionId] ?? [];
      const filtered = existing.filter((m) => m.id !== tempId);
      updatePrincipalState(pid, {
        messagesBySession: {
          ...nextState.messagesBySession,
          [sessionId]: filtered,
        },
      });
      await mergeMessagesIncremental(pid, sessionId, [resp.data], 50);

      const statusState = ensurePrincipalState(pid);
      updatePrincipalState(pid, {
        sendStatusByMessageId: {
          ...statusState.sendStatusByMessageId,
          [tempId]: 'sent',
          [resp.data.id]: 'sent',
        },
      });

      await pullSessionsIncremental(100);
      return resp.data;
    } catch {
      const errState = ensurePrincipalState(pid);
      updatePrincipalState(pid, {
        sendStatusByMessageId: {
          ...errState.sendStatusByMessageId,
          [tempId]: 'error',
        },
      });
      return null;
    }
  }

  async function createSession(request: {
    type: 'private' | 'group' | 'channel';
    name?: string;
    memberIds?: string[];
  }) {
    const resp = await imApi.createSession(request);
    await pullSessionsIncremental(100);
    return resp.data;
  }

  async function updateSession(
    sessionId: string,
    patch: { name?: string; isPinned?: boolean },
  ) {
    const resp = await imApi.updateSession(sessionId, patch);
    const pid = getActivePid();
    if (pid) {
      mergeSessions(pid, [resp.data]);
    }
    return resp.data;
  }

  function connectRealtime(callbacks?: ImSocketCallbacks) {
    const token = (localStorage.getItem('token') || '').trim();
    const pid = getCurrentPrincipalId() ?? '';
    const hadPid = principalId.value;
    principalId.value = pid || null;
    if (hadPid !== pid && pid) {
      void hydrateCursors(pid);
    }
    if (pid) {
      ensurePrincipalState(pid);
    }
    imSocketService.connect(token, {
      onNewMessageBeacon: ({ sessionId, lastMessageId }) => {
        const existingTimeout = pullTimeoutBySession.get(sessionId);
        if (typeof existingTimeout === 'number') {
          clearTimeout(existingTimeout);
        }
        const timeout = window.setTimeout(() => {
          pullTimeoutBySession.delete(sessionId);
          void (async () => {
            const activePid = getActivePid();
            if (!activePid) return;
            await ensureCursorsHydrated(activePid);
            const lastAt = pullLastAtBySession.get(sessionId);
            const now = Date.now();
            if (typeof lastAt === 'number' && now - lastAt < 200) return;
            pullLastAtBySession.set(sessionId, now);
            await hydrateMessages(activePid, sessionId);
            await pullMessagesIncremental(sessionId, 50);
          })();
        }, 200);
        pullTimeoutBySession.set(sessionId, timeout);
        callbacks?.onNewMessageBeacon?.({ sessionId, lastMessageId });
      },
      onError: (msg, sessionId) => {
        const activePid = getActivePid();
        if (activePid) {
          updatePrincipalState(activePid, { error: msg });
        }
        callbacks?.onError?.(msg, sessionId);
      },
      onMessage: callbacks?.onMessage,
      onTyping: callbacks?.onTyping,
      onMemberJoined: callbacks?.onMemberJoined,
      onMemberLeft: callbacks?.onMemberLeft,
      onAiStreamStart: callbacks?.onAiStreamStart,
      onAiToken: callbacks?.onAiToken,
      onAiStreamEnd: callbacks?.onAiStreamEnd,
      onUserPush: (data) => {
        if (userNotifyTimeout !== null) {
          clearTimeout(userNotifyTimeout);
        }
        userNotifyTimeout = window.setTimeout(() => {
          const activePid = getActivePid();
          if (!activePid) {
            userNotifyTimeout = null;
            return;
          }
          const state = ensurePrincipalState(activePid);
          if (state.loadingSessions) {
            userNotifyTimeout = null;
            return;
          }
          const now = Date.now();
          const lastAt = state.lastSessionsFetchAt;
          if (typeof lastAt === 'number' && now - lastAt < 800) {
            userNotifyTimeout = null;
            return;
          }
          void pullSessionsIncremental(100);
          userNotifyTimeout = null;
        }, 500);
        callbacks?.onUserPush?.(data);
      },
    });
    connected.value = true;
  }

  function disconnectRealtime() {
    imSocketService.disconnect();
    connected.value = false;
    principalId.value = null;
  }

  return {
    principalId,
    connected,
    error,
    sessions,
    sessionsCursor,
    loadingSessions,
    activeSessionId,
    activeSession,
    activeMessages,
    activeLoadingMessages,
    activeSendStatusByMessageId,
    loadSessionsInitial,
    pullSessionsIncremental,
    ensureCursorsHydrated,
    loadSessionDetail,
    refreshSessionMembers,
    loadMessagesInitial,
    fetchMessagesByLastId,
    pullMessagesIncremental,
    loadOlderMessages,
    openSession,
    leaveSession,
    ensureSelfIsMember,
    sendMessage,
    sendMessageOptimistic,
    createSession,
    updateSession,
    connectRealtime,
    disconnectRealtime,
  };
});
