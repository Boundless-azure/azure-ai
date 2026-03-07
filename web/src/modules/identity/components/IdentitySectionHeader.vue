<template>
  <div class="pt-8 pb-6">
    <h2 class="text-2xl font-bold text-gray-900">{{ title }}</h2>
    <p v-if="description" class="text-sm text-gray-500 mt-1">
      {{ description }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * @title Identity Section Header
 * @description 身份模块页面标题与描述区块组件。
 * @keywords-cn 标题区块, 页面标题, 身份模块
 * @keywords-en section-header, page-title, identity-module
 */
defineProps<{
  title: string;
  description?: string;
}>();
</script>
