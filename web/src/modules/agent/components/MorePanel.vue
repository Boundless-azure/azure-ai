<template>
  <div class="flex flex-col h-full bg-gray-800 border-r border-gray-700">
    <!-- Header -->
    <div class="h-16 border-b border-gray-700 flex items-center px-6 flex-shrink-0">
      <h2 class="text-lg font-bold text-white tracking-wide">{{ t('sidebar.more') }}</h2>
    </div>

    <!-- Menu List -->
    <div class="flex-1 overflow-y-auto p-4">
      <div class="grid gap-2">
        <div 
          v-for="item in menuItems" 
          :key="item.id"
          class="group flex items-center p-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-gray-700 border border-transparent hover:border-gray-600"
          @click="handleItemClick(item)"
        >
          <div class="w-10 h-10 rounded-lg bg-gray-700 group-hover:bg-gray-600 flex items-center justify-center mr-4 transition-colors">
            <i class="fa-solid text-lg text-gray-400 group-hover:text-white transition-colors" :class="`fa-${item.icon}`"></i>
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-bold text-gray-200 group-hover:text-white">{{ item.label }}</span>
            <span class="text-xs text-gray-500 group-hover:text-gray-400">{{ item.description }}</span>
          </div>
          <i class="fa-solid fa-chevron-right ml-auto text-gray-600 group-hover:text-gray-400 text-xs"></i>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @title More Panel Component
 * @description Secondary menu panel displayed when 'More' is selected.
 * @keywords-cn 更多菜单, 二级菜单, 面板
 * @keywords-en more-menu, secondary-menu, panel
 */
import { useI18n } from '../composables/useI18n';
import { computed, defineEmits } from 'vue';

const { t } = useI18n();

const emit = defineEmits<{
  (e: 'change', view: string): void;
}>();

const menuItems = computed(() => [
  { id: 'logs', label: t('sidebar.logs'), description: 'View system activity and error logs', icon: 'file-lines' },
  { id: 'backup', label: t('sidebar.backup'), description: 'Manage system backups and restoration', icon: 'database' },
  { id: 'security', label: t('sidebar.security'), description: 'Configure security settings and permissions', icon: 'shield-halved' },
  { id: 'notifications', label: t('sidebar.notifications'), description: 'Manage alert preferences', icon: 'bell' },
  { id: 'integrations', label: t('sidebar.integrations'), description: 'Connect with third-party services', icon: 'link' },
  { id: 'about', label: t('sidebar.about'), description: 'System information and version', icon: 'circle-info' },
]);

const handleItemClick = (item: { id: string }) => {
  emit('change', item.id);
};
</script>
