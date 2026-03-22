<template>
  <div class="space-y-4 h-full flex flex-col">
    <!-- Header -->
    <div class="pt-8 pb-6">
      <h2 class="text-2xl font-bold text-gray-900">数据库管理</h2>
      <p class="text-sm text-gray-500 mt-1">通过 Runner 代理连接 MongoDB 并执行查询</p>
    </div>

    <!-- Runner Selector -->
    <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <div class="flex items-center gap-4">
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-1">选择 Runner</label>
          <select
            v-model="currentRunnerId"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            @change="handleRunnerChange"
          >
            <option value="">请选择 Runner...</option>
            <option v-for="runner in runners" :key="runner.id" :value="runner.id">
              {{ runner.alias }} ({{ runner.status }})
            </option>
          </select>
        </div>
        <button
          class="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors mt-5"
          @click="loadRunners"
        >
          <i class="fa-solid fa-rotate mr-2"></i>刷新
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex gap-4 min-h-0">
      <!-- Left: Database/Collection Tree -->
      <div class="w-64 flex-shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
        <div class="p-3 border-b border-gray-100">
          <h3 class="text-sm font-bold text-gray-700">数据库 / 集合</h3>
        </div>
        <div class="flex-1 overflow-y-auto p-2">
          <div v-if="loading" class="flex items-center justify-center py-8 text-gray-400">
            <i class="fa-solid fa-spinner fa-spin"></i>
          </div>
          <div v-else-if="!currentRunnerId" class="text-center py-8 text-gray-400 text-sm">
            请先选择 Runner
          </div>
          <div v-else-if="databases.length === 0" class="text-center py-8 text-gray-400 text-sm">
            暂无数据库
          </div>
          <div v-else>
            <!-- Databases -->
            <div v-for="db in databases" :key="db" class="mb-1">
              <div
                class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm"
                :class="currentDatabase === db ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'"
                @click="selectDatabase(db)"
              >
                <i class="fa-solid fa-database text-gray-400"></i>
                <span class="truncate">{{ db }}</span>
              </div>

              <!-- Collections -->
              <div v-if="currentDatabase === db && collections.length > 0" class="ml-4">
                <div
                  v-for="col in collections"
                  :key="col.name"
                  class="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer text-sm"
                  :class="currentCollection === col.name ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'"
                  @click="selectCollection(col.name)"
                >
                  <i class="fa-solid fa-table text-gray-400 text-xs"></i>
                  <span class="truncate">{{ col.name }}</span>
                  <span class="text-xs text-gray-400 ml-auto">{{ col.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Tabs -->
      <div class="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col min-w-0">
        <!-- Tab Headers -->
        <div class="flex border-b border-gray-100">
          <button
            class="px-4 py-3 text-sm font-medium transition-colors"
            :class="activeTab === 'schema' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'schema'"
          >
            <i class="fa-solid fa-list mr-2"></i>SCHEMA
          </button>
          <button
            class="px-4 py-3 text-sm font-medium transition-colors"
            :class="activeTab === 'query' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'query'"
          >
            <i class="fa-solid fa-terminal mr-2"></i>查询
          </button>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 overflow-y-auto p-4">
          <!-- Message -->
          <div v-if="message" class="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            <i class="fa-solid fa-info-circle mr-2"></i>
            {{ message }}
          </div>

          <!-- Schema Tab -->
          <div v-if="activeTab === 'schema'">
            <div v-if="!currentCollection" class="text-center py-16 text-gray-400">
              <i class="fa-solid fa-table text-4xl mb-4"></i>
              <p>请选择一个集合查看 Schema</p>
            </div>
            <div v-else-if="loading" class="flex items-center justify-center py-16 text-gray-400">
              <i class="fa-solid fa-spinner fa-spin text-xl"></i>
            </div>
            <div v-else-if="schemaInfo">
              <div class="mb-4">
                <h4 class="text-sm font-bold text-gray-700 mb-2">字段信息</h4>
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-3 py-2 text-left font-medium text-gray-600">字段名</th>
                        <th class="px-3 py-2 text-left font-medium text-gray-600">类型</th>
                        <th class="px-3 py-2 text-left font-medium text-gray-600">数组</th>
                        <th class="px-3 py-2 text-left font-medium text-gray-600">对象</th>
                        <th class="px-3 py-2 text-left font-medium text-gray-600">出现次数</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      <tr v-for="field in schemaInfo.fields" :key="field.name" class="hover:bg-gray-50">
                        <td class="px-3 py-2 font-mono text-xs">{{ field.name }}</td>
                        <td class="px-3 py-2">
                          <span class="px-2 py-0.5 rounded text-xs" :class="getTypeClass(field.type)">
                            {{ field.type }}
                          </span>
                        </td>
                        <td class="px-3 py-2 text-center">{{ field.isArray ? '是' : '否' }}</td>
                        <td class="px-3 py-2 text-center">{{ field.isObject ? '是' : '否' }}</td>
                        <td class="px-3 py-2 text-right">{{ field.count }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 class="text-sm font-bold text-gray-700 mb-2">示例文档</h4>
                <pre class="bg-gray-50 p-4 rounded-lg text-xs font-mono overflow-x-auto">{{ JSON.stringify(schemaInfo.sampleDocuments[0], null, 2) }}</pre>
              </div>
            </div>
          </div>

          <!-- Query Tab -->
          <div v-if="activeTab === 'query'">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">查询 (MongoDB JSON)</label>
              <textarea
                v-model="queryInput"
                class="w-full h-32 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10 font-mono text-sm"
                placeholder='{ "status": "active" }'
              ></textarea>
            </div>
            <div class="flex items-center gap-2 mb-4">
              <button
                class="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                @click="handleExecute"
              >
                <i class="fa-solid fa-play mr-2"></i>执行查询
              </button>
              <button
                class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                @click="queryInput = '{}'"
              >
                清空
              </button>
            </div>
            <div v-if="queryResult">
              <div class="flex items-center gap-4 text-sm text-gray-600 mb-2">
                <span>总记录数: {{ queryResult.total }}</span>
                <span>返回: {{ queryResult.documents.length }}</span>
                <span>耗时: {{ queryResult.executionTime }}ms</span>
              </div>
              <pre class="bg-gray-50 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-96">{{ JSON.stringify(queryResult.documents, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title MongoExplorer
 * @description MongoDB 数据库管理组件，通过 Runner WebSocket 代理连接 MongoDB
 * @keywords-cn MongoDB管理, Runner WebSocket, 数据库连接, Schema查看, 查询
 * @keywords-en mongo-explorer, runner-websocket, database-connection, schema-view, query
 * @note MongoDB 查询需要 Runner 实现 WebSocket MongoDB 代理协议
 */
import { ref, onMounted } from 'vue';
import { useMongoExplorer } from '../hooks/useMongoExplorer';

const {
  loading,
  runners,
  currentRunnerId,
  databases,
  currentDatabase,
  collections,
  currentCollection,
  schemaInfo,
  queryResult,
  message,
  loadRunners,
  selectRunner,
  selectDatabase,
  selectCollection,
  executeQuery,
} = useMongoExplorer();

const activeTab = ref('schema');
const queryInput = ref('{}');

const getTypeClass = (type: string): string => {
  const map: Record<string, string> = {
    String: 'bg-green-100 text-green-700',
    Number: 'bg-blue-100 text-blue-700',
    Boolean: 'bg-purple-100 text-purple-700',
    Date: 'bg-yellow-100 text-yellow-700',
    Array: 'bg-orange-100 text-orange-700',
    Object: 'bg-red-100 text-red-700',
    Null: 'bg-gray-100 text-gray-600',
  };
  return map[type] || 'bg-gray-100 text-gray-600';
};

const handleRunnerChange = async () => {
  if (currentRunnerId.value) {
    await selectRunner(currentRunnerId.value);
  }
};

const handleExecute = async () => {
  try {
    const filter = JSON.parse(queryInput.value || '{}');
    await executeQuery({
      database: currentDatabase.value,
      collection: currentCollection.value,
      filter,
      limit: 100,
    });
  } catch (e) {
    alert('查询语法错误：' + (e instanceof Error ? e.message : 'Unknown error'));
  }
};

onMounted(async () => {
  await loadRunners();
});
</script>
