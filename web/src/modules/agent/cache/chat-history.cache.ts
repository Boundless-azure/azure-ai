/**
 * @title ChatHistory Cache
 * @description 本地持久化每个对话组的历史消息，支持按用户隔离与增量合并。
 * @keywords-cn 聊天历史缓存, 本地持久化, 增量合并
 * @keywords-en chat-history-cache, local-persistence, incremental-merge
 */

import type { GroupHistoryItem } from '../types/agent.types';

type PersistedItem = GroupHistoryItem;

type PersistedRecord = {
  key: string;
  items: PersistedItem[];
  updatedAt: number;
};

const DB_NAME = 'agent_chat_history';
const STORE_NAME = 'chat_history';
const DB_VERSION = 1;
const MAX_ITEMS_PER_GROUP = 50;

function buildKey(groupId: string, principalId?: string): string {
  const pid = (principalId || '').trim() || 'anonymous';
  return `agent.chat.history.${pid}.${groupId}`;
}

function buildLegacyKey(groupId: string, principalId?: string): string {
  const pid = (principalId || '').trim() || 'anonymous';
  return `agent.chat.history.${groupId}.${pid}`;
}

function safeParseItems(raw: unknown): PersistedItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => {
    const o = x as Record<string, unknown>;
    const role = o['role'];
    const content = o['content'];
    const timestamp = o['timestamp'];
    return (
      (role === 'system' || role === 'user' || role === 'assistant') &&
      typeof content === 'string' &&
      typeof timestamp === 'string'
    );
  }) as PersistedItem[];
}

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

export class ChatHistoryCache {
  static async init(): Promise<void> {
    try {
      const db = await openDb();
      db.close();
    } catch (_e) {
      return;
    }
  }

  static async load(
    groupId: string,
    principalId?: string,
  ): Promise<PersistedItem[]> {
    const key = buildKey(groupId, principalId);
    try {
      const record = await runInStore<PersistedRecord>(
        'readonly',
        (store) => store.get(key) as IDBRequest<PersistedRecord>,
      );
      const primary = safeParseItems(record?.items);
      if (primary.length && primary.length > 0) return primary;
      const legacyKey = buildLegacyKey(groupId, principalId);
      const legacyRecord = await runInStore<PersistedRecord>(
        'readonly',
        (store) => store.get(legacyKey) as IDBRequest<PersistedRecord>,
      );
      return safeParseItems(legacyRecord?.items);
    } catch {
      return [];
    }
  }

  static async save(
    groupId: string,
    principalId: string | undefined,
    items: PersistedItem[],
  ): Promise<void> {
    const key = buildKey(groupId, principalId);
    const trimmed =
      items.length > MAX_ITEMS_PER_GROUP
        ? items.slice(-MAX_ITEMS_PER_GROUP)
        : items;
    const record: PersistedRecord = {
      key,
      items: trimmed,
      updatedAt: Date.now(),
    };
    try {
      await runInStore('readwrite', (store) => store.put(record));
    } catch (_e) {
      return;
    }
  }

  static async merge(
    groupId: string,
    principalId: string | undefined,
    incoming: PersistedItem[],
    maxLen: number = MAX_ITEMS_PER_GROUP,
  ): Promise<PersistedItem[]> {
    const prev = await this.load(groupId, principalId);
    const combined = [...prev, ...incoming];
    const seen = new Set<string>();
    const deduped: PersistedItem[] = [];
    for (const it of combined) {
      const sig = `${it.role}|${it.timestamp}|${it.content}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      deduped.push(it);
    }
    deduped.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return ta - tb;
    });
    const trimmed = deduped.slice(-maxLen);
    await this.save(groupId, principalId, trimmed);
    return trimmed;
  }

  static async lastTimestamp(
    groupId: string,
    principalId?: string,
  ): Promise<string | undefined> {
    const items = await this.load(groupId, principalId);
    if (items.length === 0) return undefined;
    const last = items[items.length - 1];
    return last.timestamp;
  }

  static async clear(groupId: string, principalId?: string): Promise<void> {
    const key = buildKey(groupId, principalId);
    try {
      await runInStore('readwrite', (store) => store.delete(key));
    } catch (_e) {
      return;
    }
  }
}

export default ChatHistoryCache;
