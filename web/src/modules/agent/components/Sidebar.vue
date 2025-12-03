<template>
  <div 
    class="flex flex-col bg-gray-900 text-white py-4 h-full border-r border-gray-800 flex-shrink-0 transition-all duration-300 z-20"
    :class="[
      isExpanded ? 'w-full px-2' : 'w-[70px] items-center'
    ]"
  >
    <!-- Chat Item (Always First) -->
    <div 
      class="rounded-xl flex items-center cursor-pointer transition-all duration-300 relative group mb-6 border border-transparent overflow-hidden"
      :class="[
        activeView === 'chat' ? 'bg-white text-gray-900 shadow-lg shadow-white/10 scale-[1.02]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white',
        isExpanded ? 'h-14 pl-4 pr-4 justify-start' : 'w-12 h-12 justify-center'
      ]"
      @click="emitChange('chat')"
      :title="t('sidebar.chat')"
    >
      <i class="fa-solid fa-message text-xl flex-shrink-0" :class="{ 'mr-3': isExpanded }"></i>
      <span 
        class="font-bold text-lg tracking-wide whitespace-nowrap transition-all duration-300"
        :class="isExpanded ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-4 w-0 absolute'"
      >
        {{ t('sidebar.chat') }}
      </span>
      
      <!-- Tooltip (Collapsed Only) -->
      <div v-if="!isExpanded" class="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-gray-700">
        {{ t('sidebar.chat') }}
      </div>
    </div>

    <!-- Separator -->
    <div class="h-[1px] bg-gray-800 mb-6 transition-all duration-300" :class="isExpanded ? 'w-full' : 'w-8'"></div>

    <!-- Menu Items -->
    <div class="flex flex-col space-y-2 w-full flex-1 overflow-y-auto custom-scrollbar" :class="{ 'items-center': !isExpanded }">
      <div 
        v-for="item in menuItems" 
        :key="item.id"
        class="group relative flex items-center cursor-pointer transition-all duration-300 border border-transparent flex-shrink-0 overflow-hidden"
        :class="[
          activeView === item.id ? 'bg-white text-gray-900 shadow-md scale-[1.02]' : 'text-gray-400 hover:text-white hover:bg-gray-800',
          isExpanded ? 'h-12 pl-4 pr-4 rounded-lg w-full justify-start' : 'w-10 h-10 rounded-xl justify-center'
        ]"
        @click="emitChange(item.id)"
        :title="!isExpanded ? t(`sidebar.${item.id}`) : ''"
      >
        <i class="fa-solid text-lg flex-shrink-0" :class="[`fa-${item.icon}`, { 'mr-4 w-6 text-center': isExpanded }]"></i>
        <span 
          class="font-medium text-sm whitespace-nowrap transition-all duration-300"
          :class="isExpanded ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-4 w-0 absolute'"
        >
          {{ t(`sidebar.${item.id}`) }}
        </span>
        
        <!-- Tooltip (Collapsed Only) -->
        <div v-if="!isExpanded" class="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-gray-700">
          {{ t(`sidebar.${item.id}`) }}
        </div>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="mt-auto flex flex-col space-y-4 w-full pb-4 pt-4 border-t border-gray-800 transition-all duration-300" :class="{ 'items-center': !isExpanded }">
      <!-- Language Switcher -->
      <div 
        class="group relative flex items-center cursor-pointer transition-all duration-300 overflow-hidden"
        :class="[
          isExpanded ? 'h-12 pl-4 pr-4 rounded-lg w-full justify-start text-gray-400 hover:text-white hover:bg-gray-800' : 'w-10 h-10 rounded-xl justify-center text-gray-400 hover:text-white hover:bg-gray-800'
        ]"
        title="Language" 
        @click="showLanguageModal = true"
      >
        <i class="fa-solid fa-language text-lg flex-shrink-0" :class="{ 'mr-4 w-6 text-center': isExpanded }"></i>
        <span 
          class="font-medium text-sm whitespace-nowrap transition-all duration-300"
          :class="isExpanded ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-4 w-0 absolute'"
        >
          {{ currentLocale === 'en' ? 'English' : '中文' }}
        </span>
      </div>

      <!-- Settings -->
      <div 
        class="group relative flex items-center cursor-pointer transition-all duration-300 overflow-hidden"
        :class="[
          isExpanded ? 'h-12 pl-4 pr-4 rounded-lg w-full justify-start text-gray-400 hover:text-white hover:bg-gray-800' : 'w-10 h-10 rounded-xl justify-center text-gray-400 hover:text-white hover:bg-gray-800'
        ]"
        title="Settings" 
        @click="emitChange('settings')"
      >
        <i class="fa-solid fa-gear text-lg flex-shrink-0" :class="{ 'mr-4 w-6 text-center': isExpanded }"></i>
        <span 
          class="font-medium text-sm whitespace-nowrap transition-all duration-300"
          :class="isExpanded ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-4 w-0 absolute'"
        >
          {{ t('sidebar.settings') }}
        </span>
      </div>
      
      <!-- User Avatar -->
      <div 
        class="flex items-center cursor-pointer group transition-all duration-300 overflow-hidden"
        :class="[
          isExpanded ? 'w-full px-2 py-2 rounded-xl hover:bg-gray-800 border border-transparent hover:border-gray-700' : 'justify-center'
        ]"
      >
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 border-2 border-gray-700 flex items-center justify-center group-hover:border-white transition-colors flex-shrink-0">
          <span class="text-xs font-bold">US</span>
        </div>
        <div 
          class="ml-3 transition-all duration-300 overflow-hidden"
          :class="isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 absolute'"
        >
          <p class="text-sm font-bold text-white truncate">User Name</p>
          <p class="text-xs text-gray-500 truncate">user@example.com</p>
        </div>
      </div>
    </div>

    <!-- Language Modal -->
    <LanguageModal 
      v-if="showLanguageModal" 
      :current-locale="currentLocale"
      @confirm="handleLanguageConfirm"
      @close="showLanguageModal = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @title Sidebar Component
 * @description Responsive navigation sidebar with i18n and white-active theme.
 * @keywords-cn 侧边栏, 响应式导航, 国际化, 白色主题
 * @keywords-en sidebar, responsive-navigation, i18n, white-theme
 */
import { ref, defineProps, defineEmits, onMounted, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import LanguageModal from './LanguageModal.vue';

const props = defineProps<{
  activeView: string;
  isExpanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'change', view: string): void;
}>();

const { t, setLocale, currentLocale } = useI18n();
const showLanguageModal = ref(false);

const menuItems = [
  { id: 'users', icon: 'users' },
  { id: 'roles', icon: 'user-shield' },
  { id: 'resources', icon: 'folder-open' },
  { id: 'database', icon: 'database' },
  { id: 'plugins', icon: 'plug' },
  { id: 'agents', icon: 'robot' },
  { id: 'todos', icon: 'list-check' },
  { id: 'more', icon: 'ellipsis' },
];

const emitChange = (view: string) => {
  emit('change', view);
};

const handleLanguageConfirm = (locale: string) => {
  setLocale(locale as 'en' | 'cn');
  showLanguageModal.value = false;
};
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #374151;
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #4b5563;
}
</style>