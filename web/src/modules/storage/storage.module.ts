/**
 * @title Storage Module Definition
 * @description Exports and configuration for the Storage module.
 * @keywords-cn 存储模块定义, 导出, 配置, 剪贴板
 * @keywords-en storage-module-definition, exports, configuration, clipboard
 */

import * as StorageConstants from './constants/storage.constants';
import { useStorage } from './hooks/useStorage';
import { useResourceUpload } from './hooks/useResourceUpload';
import { useStorageClipboardStore } from './store/clipboard.store';
import StoragePage from './pages/StoragePage.vue';

export const StorageModule = {
  name: 'StorageModule',
  constants: StorageConstants,
  hooks: { useStorage, useResourceUpload },
  pages: { StoragePage },
  stores: { useStorageClipboardStore },
};

export * from './types/storage.types';
export * from './constants/storage.constants';
export { useStorage } from './hooks/useStorage';
export { useResourceUpload } from './hooks/useResourceUpload';
export { useStorageClipboardStore } from './store/clipboard.store';
