<template>
  <Teleport to="body">
    <div
      class="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100000] flex flex-col items-center gap-2 pointer-events-none"
    >
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto min-w-[300px] max-w-md p-4 rounded-lg shadow-lg flex items-start gap-3 border"
          :class="{
            'bg-white border-green-200 text-green-800': toast.type === 'success',
            'bg-white border-red-200 text-red-800': toast.type === 'error',
            'bg-white border-blue-200 text-blue-800': toast.type === 'info',
            'bg-white border-yellow-200 text-yellow-800': toast.type === 'warning',
          }"
        >
          <!-- Icons -->
          <i
            v-if="toast.type === 'success'"
            class="fa-solid fa-circle-check mt-1 text-green-500"
          ></i>
          <i
            v-if="toast.type === 'error'"
            class="fa-solid fa-circle-exclamation mt-1 text-red-500"
          ></i>
          <i
            v-if="toast.type === 'info'"
            class="fa-solid fa-circle-info mt-1 text-blue-500"
          ></i>
          <i
            v-if="toast.type === 'warning'"
            class="fa-solid fa-triangle-exclamation mt-1 text-yellow-500"
          ></i>

          <div class="flex-1 text-sm font-medium break-words">
            {{ toast.message }}
          </div>

          <button
            @click="removeToast(toast.id)"
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useUIStore } from '../store/ui.store';

const uiStore = useUIStore();
const { toasts } = storeToRefs(uiStore);
const { removeToast } = uiStore;
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
