/**
 * @title useMongoExplorer Hook
 * @description MongoDB Explorer module composable hook (via Runner WebSocket)
 * @keywords-cn MongoDB浏览器Hook, Runner WebSocket Hook
 * @keywords-en mongo-explorer-hook, runner-websocket-hook
 * @note MongoDB 查询通过 Runner WebSocket 直接通信，前端需要实现 WebSocket 连接
 */
import { ref } from 'vue';
import * as mongoApi from '../../../api/mongo-explorer';
import type { CollectionInfo, SchemaInfo, QueryResult } from '../types/mongo-explorer.types';

interface RunnerInfo {
  id: string;
  alias: string;
  status: string;
}

export function useMongoExplorer() {
  const loading = ref(false);
  const runners = ref<RunnerInfo[]>([]);
  const currentRunnerId = ref<string>('');
  const databases = ref<string[]>([]);
  const currentDatabase = ref<string>('');
  const collections = ref<CollectionInfo[]>([]);
  const currentCollection = ref<string>('');
  const schemaInfo = ref<SchemaInfo | null>(null);
  const queryResult = ref<QueryResult | null>(null);
  const error = ref<string | null>(null);
  const message = ref<string | null>(null);

  // 加载可用的 Runner
  async function loadRunners() {
    loading.value = true;
    error.value = null;
    try {
      const res = await mongoApi.getRunnersWithMongo();
      runners.value = res.data || [];
      // 自动选择第一个在线的 Runner
      if (runners.value.length > 0 && !currentRunnerId.value) {
        currentRunnerId.value = runners.value[0].id;
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load runners';
    } finally {
      loading.value = false;
    }
  }

  // 选择 Runner
  async function selectRunner(runnerId: string) {
    currentRunnerId.value = runnerId;
    currentDatabase.value = '';
    currentCollection.value = '';
    collections.value = [];
    schemaInfo.value = null;
    queryResult.value = null;
    message.value = 'MongoDB 查询功能需要 Runner 支持 WebSocket MongoDB 代理协议';
  }

  // 选择数据库
  async function selectDatabase(_dbName: string) {
    currentDatabase.value = _dbName;
    currentCollection.value = '';
    schemaInfo.value = null;
    message.value = 'MongoDB 查询功能需要 Runner 支持 WebSocket MongoDB 代理协议';
  }

  // 选择集合
  async function selectCollection(_collectionName: string) {
    currentCollection.value = _collectionName;
    message.value = 'MongoDB 查询功能需要 Runner 支持 WebSocket MongoDB 代理协议';
  }

  // 加载 Schema（占位）
  async function loadSchema() {
    message.value = 'MongoDB 查询功能需要 Runner 支持 WebSocket MongoDB 代理协议';
  }

  // 执行查询（占位）
  async function executeQuery(_query: { filter?: Record<string, unknown> }): Promise<QueryResult | null> {
    message.value = 'MongoDB 查询功能需要 Runner 支持 WebSocket MongoDB 代理协议';
    return null;
  }

  // 重置
  function reset() {
    runners.value = [];
    currentRunnerId.value = '';
    databases.value = [];
    currentDatabase.value = '';
    collections.value = [];
    currentCollection.value = '';
    schemaInfo.value = null;
    queryResult.value = null;
    error.value = null;
    message.value = null;
  }

  return {
    loading,
    runners,
    currentRunnerId,
    databases,
    currentDatabase,
    collections,
    currentCollection,
    schemaInfo,
    queryResult,
    error,
    message,
    loadRunners,
    selectRunner,
    loadDatabases: async () => {},
    selectDatabase,
    loadCollections: async () => {},
    selectCollection,
    loadSchema,
    executeQuery,
    reset,
  };
}
