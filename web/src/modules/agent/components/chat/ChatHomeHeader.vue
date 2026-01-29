<template>
  <div class="flex flex-col">
    <div class="h-14 flex items-center justify-between px-4">
      <div class="flex items-center space-x-2">
        <div
          class="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-sm"
        >
          <i class="fa-solid fa-robot"></i>
        </div>
        <h1 class="text-lg font-bold text-gray-800">Azure AI</h1>
      </div>
      <div class="flex items-center space-x-3"></div>
    </div>

    <div class="px-4 pb-3">
      <div class="relative group">
        <div
          class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
        >
          <i
            class="fa-solid fa-magnifying-glass text-gray-400 text-xs group-focus-within:text-green-500 transition-colors"
          ></i>
        </div>
        <input
          :value="searchQuery"
          type="text"
          class="block w-full pl-9 pr-20 py-2 bg-gray-100 border-none rounded-xl text-sm placeholder-gray-400 focus:ring-2 focus:ring-green-500/20 focus:bg-white transition-all"
          placeholder="搜索会话..."
          @input="onSearchInput"
        />
        <div class="absolute inset-y-0 right-1.5 flex items-center">
          <button
            @click="toggleOnlyAi"
            class="flex items-center px-2 py-1 rounded-lg text-[10px] font-bold transition-all border select-none"
            :class="
              onlyAi
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'
            "
          >
            <i class="fa-solid fa-robot mr-1"></i>
            AI
          </button>
          <div class="relative ml-2">
            <button
              @click="toggleCreateMenu"
              class="flex items-center px-2 py-1 rounded-lg text-[10px] font-bold transition-all border select-none bg-white text-gray-400 border-gray-100 hover:border-gray-300"
            >
              <i class="fa-solid fa-plus"></i>
            </button>
            <div
              v-if="isCreateMenuOpen"
              class="absolute right-0 top-full mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50"
            >
              <button
                @click="selectCreateType('group')"
                class="w-full text-left px-4 py-1.5 hover:bg-gray-50 text-sm"
              >
                新建群聊
              </button>
              <button
                @click="selectCreateType('dm')"
                class="w-full text-left px-4 py-1.5 hover:bg-gray-50 text-sm"
              >
                新建私聊
              </button>
              <button
                @click="selectCreateType('assistant')"
                class="w-full text-left px-4 py-1.5 hover:bg-gray-50 text-sm"
              >
                新建助手
              </button>
              <button
                @click="selectCreateType('system')"
                class="w-full text-left px-4 py-1.5 hover:bg-gray-50 text-sm"
              >
                系统通知
              </button>
              <button
                @click="selectCreateType('todo')"
                class="w-full text-left px-4 py-1.5 hover:bg-gray-50 text-sm"
              >
                待办通知
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Chat Home Header
 * @description 首页顶部栏与会话搜索创建入口。
 * @keywords-cn 首页头部, 搜索会话, 创建会话
 * @keywords-en home-header, search, create-session
 */
interface Props {
  searchQuery: string;
  onlyAi: boolean;
  isCreateMenuOpen: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:onlyAi', value: boolean): void;
  (e: 'update:isCreateMenuOpen', value: boolean): void;
  (e: 'createSession', type: 'group' | 'dm' | 'assistant' | 'system' | 'todo'):
    void;
}>();

const onSearchInput = (event: Event) => {
  const target = event.target;
  if (!target || !(target instanceof HTMLInputElement)) return;
  emit('update:searchQuery', target.value);
};

const toggleOnlyAi = () => {
  emit('update:onlyAi', !props.onlyAi);
};

const toggleCreateMenu = () => {
  emit('update:isCreateMenuOpen', !props.isCreateMenuOpen);
};

const selectCreateType = (
  type: 'group' | 'dm' | 'assistant' | 'system' | 'todo',
) => {
  emit('createSession', type);
  emit('update:isCreateMenuOpen', false);
};
</script>
