<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-100 flex items-center bg-gray-50">
      <button
        @click="$emit('close')"
        class="mr-3 w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
      >
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <h3 class="font-bold text-gray-800 text-lg flex-1">选择成员</h3>
    </div>

    <!-- Search -->
    <div class="p-4 border-b border-gray-100">
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <i class="fa-solid fa-magnifying-glass text-gray-400"></i>
        </div>
        <input
          v-model="searchQuery"
          type="text"
          class="block w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
          placeholder="搜索用户..."
          @input="handleSearch"
        />
      </div>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto custom-scrollbar p-2">
      <div v-if="loading" class="flex items-center justify-center py-10">
        <i class="fas fa-spinner fa-spin text-green-500 text-2xl"></i>
      </div>

      <div
        v-else-if="filteredItems.length === 0"
        class="flex flex-col items-center justify-center py-10 text-gray-400"
      >
        <i class="fa-solid fa-user-slash text-2xl mb-2"></i>
        <span class="text-sm">未找到用户</span>
      </div>

      <div v-else class="space-y-1">
        <div
          v-for="item in filteredItems"
          :key="item.id"
          class="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
          @click="toggleSelection(item.id)"
        >
          <!-- Checkbox -->
          <div
            class="w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors"
            :class="
              selectedIds.includes(item.id)
                ? 'bg-green-500 border-green-500'
                : 'border-gray-300 group-hover:border-green-400'
            "
          >
            <i
              v-if="selectedIds.includes(item.id)"
              class="fa-solid fa-check text-white text-xs"
            ></i>
          </div>

          <!-- Avatar -->
          <div
            class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden mr-3"
          >
            <img
              v-if="item.avatarUrl"
              :src="item.avatarUrl"
              class="w-full h-full object-cover"
            />
            <i v-else class="fa-solid fa-user"></i>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate">
              {{ item.displayName }}
            </p>
            <p class="text-xs text-gray-400 truncate">
              {{ item.email || item.principalType }}
            </p>
          </div>

          <!-- Disabled Badge if already member -->
          <span
            v-if="existingMembers.includes(item.id)"
            class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded"
            >已添加</span
          >
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
      <div class="text-sm text-gray-500">
        已选择
        <span class="font-bold text-green-600">{{ selectedIds.length }}</span>
        人
      </div>
      <div class="flex space-x-3">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          @click="handleConfirm"
          :disabled="selectedIds.length === 0"
          class="px-6 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
        >
          确认添加
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Member Selector Panel
 * @description A panel component for searching and selecting members to add to a chat session. Supports batch selection and exclusion of existing members.
 * @keywords-cn 成员选择, 邀请成员, 通讯录, 批量选择, 面板
 * @keywords-en member-selector, invite-member, address-book, batch-select, panel
 */
import { ref, computed, onMounted } from 'vue';
import { usePrincipals } from '../../identity/hooks/usePrincipals';
import type { IdentityPrincipalItem } from '../../identity/types/identity.types';

// Simple debounce implementation to avoid lodash-es dependency
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function (...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

const props = defineProps<{
  existingMembers: string[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', ids: string[]): void;
}>();

const { list, loading } = usePrincipals();
const items = ref<IdentityPrincipalItem[]>([]);
const searchQuery = ref('');
const selectedIds = ref<string[]>([]);

const loadData = async () => {
  try {
    const res = await list({ q: searchQuery.value });
    items.value = res || [];
  } catch (e) {
    console.error(e);
  }
};

const handleSearch = debounce(() => {
  loadData();
}, 300);

const filteredItems = computed(() => {
  return items.value;
});

const toggleSelection = (id: string) => {
  if (props.existingMembers.includes(id)) return;

  const index = selectedIds.value.indexOf(id);
  if (index === -1) {
    selectedIds.value.push(id);
  } else {
    selectedIds.value.splice(index, 1);
  }
};

const handleConfirm = () => {
  emit('confirm', selectedIds.value);
};

onMounted(() => {
  loadData();
});
</script>
