<template>
  <div class="flex flex-col h-full bg-white relative">
    <!-- Header -->
    <div class="h-16 border-b border-gray-200 flex items-center px-6 bg-white">
      <h2 class="text-lg font-bold text-gray-800">{{ title }}</h2>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
      <div class="border-2 border-dashed border-gray-200 rounded-xl h-full flex flex-col items-center justify-center text-gray-400">
        <i class="fa-solid fa-layer-group text-4xl mb-4"></i>
        <p>Content for {{ title }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>
