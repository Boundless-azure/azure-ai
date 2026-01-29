<template>
  <div class="max-w-7xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-900">{{ t('todo.title') }}</h2>
      <div class="flex space-x-2">
        <select v-model="status" class="border rounded px-3 py-2 text-sm">
          <option value="">{{ t('todo.allStatuses') }}</option>
          <option value="unread">{{ t('todo.status.unread') }}</option>
          <option value="read">{{ t('todo.status.read') }}</option>
          <option value="completed">{{ t('todo.status.completed') }}</option>
          <option value="rejected">{{ t('todo.status.rejected') }}</option>
          <option value="failed">{{ t('todo.status.failed') }}</option>
        </select>
        <button @click="refresh" class="px-3 py-2 text-sm bg-black text-white rounded">{{ t('common.confirm') }}</button>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
            <th class="px-4 py-3">{{ t('todo.columns.initiator') }}</th>
            <th class="px-4 py-3">{{ t('todo.columns.title') }}</th>
            <th class="px-4 py-3">{{ t('todo.columns.plugin') }}</th>
            <th class="px-4 py-3">{{ t('todo.columns.description') }}</th>
            <th class="px-4 py-3">{{ t('todo.columns.action') }}</th>
            <th class="px-4 py-3">{{ t('todo.columns.recipient') }}</th>
            <th class="px-4 py-3">{{ t('todo.columns.status') }}</th>
            <th class="px-4 py-3">{{ t('todo.columns.receipt') }}</th>
            <th class="px-4 py-3">{{ t('todo.columns.operations') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="9" class="px-4 py-6 text-center text-gray-400">Loading...</td>
          </tr>
          <tr v-else-if="items.length === 0">
            <td colspan="9" class="px-4 py-6 text-center text-gray-400">{{ t('todo.empty') }}</td>
          </tr>
          <tr v-for="item in items" :key="item.id" class="border-t border-gray-100 hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-700">{{ item.initiatorId }}</td>
            <td class="px-4 py-3 text-sm text-gray-900 font-medium">{{ item.title }}</td>
            <td class="px-4 py-3 text-sm text-gray-700">{{ item.pluginId || '—' }}</td>
            <td class="px-4 py-3 text-sm text-gray-700">{{ item.description || '—' }}</td>
            <td class="px-4 py-3 text-xs text-gray-700"><pre class="whitespace-pre-wrap">{{ stringify(item.action) }}</pre></td>
            <td class="px-4 py-3 text-sm text-gray-700">{{ item.recipientId }}</td>
            <td class="px-4 py-3 text-xs">
              <span class="px-2 py-1 rounded-full font-bold"
                :class="statusClass(item.status)">{{ t(`todo.status.${item.status}`) }}</span>
            </td>
            <td class="px-4 py-3 text-xs text-gray-700"><pre class="whitespace-pre-wrap">{{ stringify(item.receipt) }}</pre></td>
            <td class="px-4 py-3 text-sm">
              <div class="flex items-center space-x-2">
                <button class="px-2 py-1 border rounded text-xs" @click="markRead(item)">{{ t('todo.actions.markRead') }}</button>
                <button class="px-2 py-1 border rounded text-xs" @click="markDone(item)">{{ t('todo.actions.markDone') }}</button>
                <button class="px-2 py-1 border rounded text-xs text-red-600" @click="removeItem(item)">{{ t('common.delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '../../agent/composables/useI18n';
import type { TodoItem } from '../types/todo.types';
import { useTodos } from '../hooks/useTodos';

const { t } = useI18n();
const { loading, items, list, update, remove } = useTodos();
const status = ref('');

const stringify = (obj: unknown) => {
  try { return obj ? JSON.stringify(obj, null, 2) : '—'; } catch { return '—'; }
};

const statusClass = (s: string) => {
  switch (s) {
    case 'unread': return 'bg-orange-50 text-orange-600';
    case 'read': return 'bg-blue-50 text-blue-600';
    case 'completed': return 'bg-green-50 text-green-600';
    case 'rejected': return 'bg-gray-100 text-gray-600';
    case 'failed': return 'bg-red-50 text-red-600';
    default: return 'bg-gray-50 text-gray-600';
  }
};

const refresh = async () => {
  await list(status.value ? { status: status.value } : undefined);
};

const markRead = async (item: TodoItem) => {
  await update(item.id, { status: 'read' });
  await refresh();
};

const markDone = async (item: TodoItem) => {
  await update(item.id, { status: 'completed' });
  await refresh();
};

const removeItem = async (item: TodoItem) => {
  await remove(item.id);
  await refresh();
};

onMounted(refresh);
</script>
