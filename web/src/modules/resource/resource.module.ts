/**
 * @title Resource Module (Web)
 * @description 导出资源上传 hook 与可复用资源相关组件。
 * @keywords-cn 资源模块, 上传hook, 组件导出
 * @keywords-en resource-module, upload-hook, exports
 */

export { useResourceUpload } from './hooks/useResourceUpload';
export { default as SquareAvatarCropModal } from './components/SquareAvatarCropModal.vue';
export { default as ImageViewer } from './components/ImageViewer.vue';
export {
  resolveImageUrl,
  resolveResourceUrl,
} from './services/resource-url.service';
export type { ResolveResourceUrlOptions } from './services/resource-url.service';
