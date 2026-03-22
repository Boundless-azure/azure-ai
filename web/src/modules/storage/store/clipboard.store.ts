/**
 * @title Storage Clipboard Store
 * @description 资源库剪贴板状态，管理复制/粘贴的资源ID列表
 * @keywords-cn 资源库剪贴板, 复制, 粘贴, 资源ID
 * @keywords-en storage-clipboard, copy, paste, resource-id
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface ClipboardItem {
  nodeId: string;
  resourceId: string;
  name: string;
  type: 'file' | 'folder';
}

export const useStorageClipboardStore = defineStore('storage_clipboard', () => {
  const clipboard = ref<ClipboardItem[]>([]);
  const lastCopyTime = ref<number>(0);

  const hasClipboard = computed(() => clipboard.value.length > 0);
  const clipboardCount = computed(() => clipboard.value.length);
  const resourceIds = computed(() => clipboard.value.map(c => c.resourceId));

  /**
   * 复制资源到剪贴板
   * @keyword-en copy-to-clipboard
   */
  function copy(items: ClipboardItem[]) {
    clipboard.value = [...items];
    lastCopyTime.value = Date.now();
  }

  /**
   * 添加资源到剪贴板
   * @keyword-en add-to-clipboard
   */
  function addToClipboard(item: ClipboardItem) {
    // 避免重复
    if (!clipboard.value.find(c => c.resourceId === item.resourceId)) {
      clipboard.value.push(item);
      lastCopyTime.value = Date.now();
    }
  }

  /**
   * 清空剪贴板
   * @keyword-en clear-clipboard
   */
  function clear() {
    clipboard.value = [];
    lastCopyTime.value = 0;
  }

  return {
    clipboard,
    hasClipboard,
    clipboardCount,
    resourceIds,
    lastCopyTime,
    copy,
    addToClipboard,
    clear,
  };
});
