/**
 * @title IM Config Cache
 * @description 前端IM配置的本地持久化（IndexedDB），记录每个会话最后一次接收消息时间。
 * @keywords-cn IM配置, 最近接收时间, 本地持久化
 * @keywords-en im-config, last-received-at, local-persistence
 */

export type ImConfigRecord = {
  key: string;
  lastReceivedAt?: string;
  lastMessageId?: string;
  updatedAt: number;
};

const DB_NAME = 'agent_im_config';
const STORE_NAME = 'im_config';
const DB_VERSION = 1;

function buildKey(sessionId: string, principalId?: string): string {
  const pid = (principalId || '').trim() || 'anonymous';
  return `agent.im.config.${pid}.${sessionId}`;
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
          const err = rawErr instanceof Error ? rawErr : new Error(String(rawErr));
          db.close();
          reject(err);
        };
        tx.onabort = () => {
          const rawErr = tx.error || request?.error;
          const err = rawErr instanceof Error ? rawErr : new Error(String(rawErr));
          db.close();
          reject(err);
        };
      }),
    (err) => Promise.reject(err instanceof Error ? err : new Error(String(err))),
  );
}

export default class ImConfigCache {
  static async init(): Promise<void> {
    try {
      const db = await openDb();
      db.close();
    } catch {}
  }

  static async getLastReceivedAt(
    sessionId: string,
    principalId?: string,
  ): Promise<string | undefined> {
    try {
      const key = buildKey(sessionId, principalId);
      const rec = await runInStore<ImConfigRecord>(
        'readonly',
        (store) => store.get(key) as IDBRequest<ImConfigRecord>,
      );
      return rec?.lastReceivedAt || undefined;
    } catch {
      return undefined;
    }
  }

  static async getLastMessageId(
    sessionId: string,
    principalId?: string,
  ): Promise<string | undefined> {
    try {
      const key = buildKey(sessionId, principalId);
      const rec = await runInStore<ImConfigRecord>(
        'readonly',
        (store) => store.get(key) as IDBRequest<ImConfigRecord>,
      );
      return rec?.lastMessageId || undefined;
    } catch {
      return undefined;
    }
  }

  static async setLastReceivedAt(
    sessionId: string,
    principalId: string | undefined,
    iso: string,
  ): Promise<void> {
    const key = buildKey(sessionId, principalId);
    const record: ImConfigRecord = {
      key,
      lastReceivedAt: iso,
      updatedAt: Date.now(),
    };
    try {
      await runInStore('readwrite', (store) => store.put(record));
    } catch {}
  }

  static async setLastMessageId(
    sessionId: string,
    principalId: string | undefined,
    id: string,
  ): Promise<void> {
    const key = buildKey(sessionId, principalId);
    const record: ImConfigRecord = {
      key,
      lastMessageId: id,
      updatedAt: Date.now(),
    };
    try {
      await runInStore('readwrite', (store) => store.put(record));
    } catch {}
  }
}
