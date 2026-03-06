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
  let sessionsPullTimeout: number | null = null;

  const pullTimeoutBySession = new Map<string, number>();
  const pullLastAtBySession = new Map<string, number>();

  const hydratingCursors = ref(false);
  const hydratedCursorPids = new Set<string>();
  const hydratePromiseByPid = new Map<string, Promise<void>>();
  const STORAGE_KEY_PREFIX = 'im.cursors';
  const DB_NAME = 'im_store';
  const CURSORS_STORE_NAME = 'cursors';
  const SESSIONS_STORE_NAME = 'sessions';
  const MESSAGES_STORE_NAME = 'messages';
  const DB_VERSION = 3;

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

  type ImSessionsRecord = {
    key: string;
    items: ImSessionSummary[];
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
        if (!db.objectStoreNames.contains(SESSIONS_STORE_NAME)) {
          db.createObjectStore(SESSIONS_STORE_NAME, { keyPath: 'key' });
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

  function runInSessionsStore<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T | undefined> {
    return runInStore(SESSIONS_STORE_NAME, mode, action);
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

  function getSessionsStorageKey(pid: string): string {
    return `im.sessions:${pid}`;
  }

  function getMessagesStorageKey(pid: string, sessionId: string): string {
    return `im.messages:${pid}:${sessionId}`;
  }

  async function hydrateSessions(pid: string) {
    try {
      const key = getSessionsStorageKey(pid);
      const rec = await runInSessionsStore<ImSessionsRecord>(
        'readonly',
        (store) => store.get(key) as IDBRequest<ImSessionsRecord>,
      );
      if (!rec || !Array.isArray(rec.items)) return;
      const state = ensurePrincipalState(pid);
      if (state.sessions.length > 0) return;
      updatePrincipalState(pid, { sessions: sortSessions(rec.items) });
    } catch {
      return;
    }
  }

  async function persistSessions(pid: string) {
    const state = ensurePrincipalState(pid);
    const key = getSessionsStorageKey(pid);
    const record: ImSessionsRecord = {
      key,
      items: state.sessions,
      updatedAt: Date.now(),
    };
    try {
      await runInSessionsStore('readwrite', (store) => store.put(record));
    } catch {
      return;
    }
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
    if (existing !== undefined) {
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
    void hydrateSessions(bootstrapPid);
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
    void persistSessions(pid);
  }

  function mergeMessages(
    pid: string,
    sessionId: string,
    updates: ImMessageInfo[],
  ) {
    const state = ensurePrincipalState(pid);
    const existing = state.messagesBySession[sessionId] ?? [];

    const normalizeId = (v: string | null | undefined) => (v ?? '').trim();
    const normalizeContent = (v: string) => v.trim();
    const timeMs = (iso: string) => {
      const ms = Date.parse(iso);
      return Number.isFinite(ms) ? ms : 0;
    };

    const normalizedPid = pid.trim();
    const tempCandidates = existing.filter(
      (m) =>
        m.id.startsWith('temp-') && normalizeId(m.senderId) === normalizedPid,
    );

    const tempIdsToRemove = new Set<string>();
    for (const update of updates) {
      if (update.id.startsWith('temp-')) continue;
      if (normalizeId(update.senderId) !== normalizedPid) continue;

      const updateTime = timeMs(update.createdAt);
      const updateContent = normalizeContent(update.content);

      const exactMatches = tempCandidates.filter(
        (e) =>
          !tempIdsToRemove.has(e.id) &&
          e.messageType === update.messageType &&
          normalizeContent(e.content) === updateContent,
      );

      let match: ImMessageInfo | undefined;
      if (exactMatches.length > 0) {
        match = exactMatches.reduce<ImMessageInfo>((best, cur) => {
          const bDiff = Math.abs(timeMs(best.createdAt) - updateTime);
          const cDiff = Math.abs(timeMs(cur.createdAt) - updateTime);
          return cDiff < bDiff ? cur : best;
        }, exactMatches[0]);
      } else {
        const nearMatches = tempCandidates.filter((e) => {
          if (tempIdsToRemove.has(e.id)) return false;
          if (e.messageType !== update.messageType) return false;
          const diff = Math.abs(timeMs(e.createdAt) - updateTime);
          return diff < 120000;
        });
        if (nearMatches.length > 0) {
          match = nearMatches.reduce<ImMessageInfo>((best, cur) => {
            const bDiff = Math.abs(timeMs(best.createdAt) - updateTime);
            const cDiff = Math.abs(timeMs(cur.createdAt) - updateTime);
            return cDiff < bDiff ? cur : best;
          }, nearMatches[0]);
        }
      }

      if (match) tempIdsToRemove.add(match.id);
    }

    const map = new Map(
      existing.filter((m) => !tempIdsToRemove.has(m.id)).map((m) => [m.id, m]),
    );
    for (const m of updates) {
      map.set(m.id, m);
    }
    const merged = sortMessages([...map.values()]);
    let nextSendStatusByMessageId = state.sendStatusByMessageId;
    if (tempIdsToRemove.size > 0) {
      nextSendStatusByMessageId = { ...state.sendStatusByMessageId };
      for (const id of tempIdsToRemove) {
        delete nextSendStatusByMessageId[id];
      }
    }
    updatePrincipalState(pid, {
      messagesBySession: { ...state.messagesBySession, [sessionId]: merged },
      sendStatusByMessageId: nextSendStatusByMessageId,
    });
  }

  function replaceTempMessage(
    pid: string,
    sessionId: string,
    tempId: string,
    realMessage: ImMessageInfo,
  ) {
    const state = ensurePrincipalState(pid);
    const existing = state.messagesBySession[sessionId] ?? [];

    const filtered = existing.filter(
      (m) => m.id !== tempId && m.id !== realMessage.id,
    );
    const merged = sortMessages([...filtered, realMessage]);

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
      await persistSessions(pid);
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
      await persistSessions(pid);
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
    await refreshSessionMembers(sessionId);
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
      isAnnouncement: false,
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

      // 成功发送后，显式替换临时消息
      replaceTempMessage(pid, sessionId, tempId, resp.data);

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

  async function ensureFixedEntrySession(
    fixedId: 'azure-ai' | 'ai-notify',
    title?: string,
  ): Promise<string> {
    const pid = getActivePid();
    if (!pid) return fixedId;

    const state = ensurePrincipalState(pid);
    if (state.sessions.some((s) => s.sessionId === fixedId)) {
      return fixedId;
    }

    try {
      const resp = await imApi.getSession(fixedId);
      mergeSessions(pid, [resp.data]);
      return fixedId;
    } catch {
      try {
        const created = await createSession({
          type: 'private',
          name: title || undefined,
          memberIds: [fixedId],
        });
        return created.sessionId;
      } catch {
        return fixedId;
      }
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

  async function deleteSession(sessionId: string): Promise<boolean> {
    const resp = await imApi.deleteSession(sessionId);
    const pid = getActivePid();
    if (pid) {
      const state = ensurePrincipalState(pid);
      const nextSessions = state.sessions.filter(
        (s) => s.sessionId !== sessionId,
      );

      const nextSessionDetails = { ...state.sessionDetails };
      delete nextSessionDetails[sessionId];

      const nextMessagesBySession = { ...state.messagesBySession };
      delete nextMessagesBySession[sessionId];

      const nextMessageCursors = { ...state.messageCursors };
      delete nextMessageCursors[sessionId];

      const nextLoadingMessages = { ...state.loadingMessages };
      delete nextLoadingMessages[sessionId];

      const shouldClearActive = state.activeSessionId === sessionId;
      updatePrincipalState(pid, {
        sessions: nextSessions,
        sessionDetails: nextSessionDetails,
        messagesBySession: nextMessagesBySession,
        messageCursors: nextMessageCursors,
        loadingMessages: nextLoadingMessages,
        activeSessionId: shouldClearActive ? null : state.activeSessionId,
      });

      if (shouldClearActive) {
        imSocketService.leaveRoom(sessionId);
      }

      await persistSessions(pid);
      await persistCursors(pid);
    }
    return !!resp.data.success;
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

    const scheduleSessionsPull = () => {
      if (sessionsPullTimeout !== null) {
        clearTimeout(sessionsPullTimeout);
      }
      sessionsPullTimeout = window.setTimeout(() => {
        const activePid = getActivePid();
        if (!activePid) {
          sessionsPullTimeout = null;
          return;
        }
        const state = ensurePrincipalState(activePid);
        if (state.loadingSessions) {
          sessionsPullTimeout = null;
          return;
        }
        const now = Date.now();
        const lastAt = state.lastSessionsFetchAt;
        if (typeof lastAt === 'number' && now - lastAt < 300) {
          sessionsPullTimeout = null;
          return;
        }
        void pullSessionsIncremental(100);
        sessionsPullTimeout = null;
      }, 250);
    };

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
            scheduleSessionsPull();
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
      onMessage: (message, sessionId) => {
        const activePid = getActivePid();
        if (activePid) {
          void (async () => {
            try {
              await mergeMessagesIncremental(
                activePid,
                sessionId,
                [message],
                50,
              );
              scheduleSessionsPull();
            } catch {
              return;
            }
          })();
        }
        callbacks?.onMessage?.(message, sessionId);
      },
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
    deleteSession,
    ensureFixedEntrySession,
    connectRealtime,
    disconnectRealtime,
  };
});
