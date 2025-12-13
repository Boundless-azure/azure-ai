import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

export const useUIStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([]);

  const removeToast = (id: string) => {
    const index = toasts.value.findIndex((t) => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  };

  const showToast = (
    message: string,
    type: ToastType = 'info',
    duration: number = 3000,
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2);
    toasts.value.push({ id, type, message, duration });

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };

  return {
    toasts,
    showToast,
    removeToast,
  };
});
