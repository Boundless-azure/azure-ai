<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" @click.self="$emit('close')">
      <div class="bg-white rounded-2xl border border-gray-200 shadow-2xl w-80 p-6 transform transition-all scale-100">
        <h3 class="text-xl font-bold text-gray-900 mb-6 text-center">{{ t('modal.selectLanguage') }}</h3>
        
        <div class="space-y-3 mb-8">
          <div 
            v-for="locale in supportedLocales" 
            :key="locale.code"
            class="flex items-center p-4 rounded-xl border cursor-pointer transition-all duration-200 group"
            :class="selectedLocale === locale.code 
              ? 'border-blue-500 bg-blue-50 shadow-sm' 
              : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'"
            @click="selectedLocale = locale.code"
          >
            <div class="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center mr-4 shadow-sm group-hover:scale-110 transition-transform">
              <i class="fa-solid text-lg text-gray-700" :class="`fa-${locale.icon}`"></i>
            </div>
            <div class="flex flex-col">
              <span class="font-bold text-gray-800" :class="{ 'text-blue-700': selectedLocale === locale.code }">
                {{ locale.label }}
              </span>
              <span class="text-xs text-gray-400 uppercase tracking-wider">{{ locale.code }}</span>
            </div>
            <div v-if="selectedLocale === locale.code" class="ml-auto text-blue-500">
              <i class="fa-solid fa-circle-check text-xl"></i>
            </div>
          </div>
        </div>
        
        <div class="flex justify-between space-x-3">
          <button 
            class="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200" 
            @click="$emit('close')"
          >
            {{ t('modal.cancel') }}
          </button>
          <button 
            class="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-black transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transform active:scale-95" 
            @click="confirmSelection"
          >
            {{ t('modal.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * @title Language Modal Component
 * @description A modal dialog for selecting the application language.
 * @keywords-cn 语言选择, 弹窗, 国际化
 * @keywords-en language-selection, modal, i18n
 */
import { ref } from 'vue';
import { useI18n } from '../composables/useI18n';

const props = defineProps<{
  currentLocale: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', locale: string): void;
}>();

const { t, supportedLocales } = useI18n();
const selectedLocale = ref(props.currentLocale);

const confirmSelection = () => {
  emit('confirm', selectedLocale.value);
};
</script>
