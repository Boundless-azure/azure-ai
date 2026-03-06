/**
 * @title Resource Module Tip (Web)
 * @description 前端资源模块的描述与关键词映射。
 * @keywords-cn 模块描述, 资源上传, 进度, 哈希对照
 * @keywords-en module-description, resource-upload, progress, hash-map
 */

export const moduleTip = {
  description:
    'Resource module provides unified upload hook with progress and resource id/path mapping for reuse across modules.',
  keywords: {
    cn: {
      资源上传API: 'src/api/resource.ts',
      资源上传hook: 'src/modules/resource/hooks/useResourceUpload.ts',
      方形头像裁剪组件:
        'src/modules/resource/components/SquareAvatarCropModal.vue',
      资源类型: 'src/modules/resource/types/resource.types.ts',
      资源模块导出: 'src/modules/resource/resource.module.ts',
    },
    en: {
      resource_api: 'src/api/resource.ts',
      resource_upload_hook: 'src/modules/resource/hooks/useResourceUpload.ts',
      square_avatar_crop_modal:
        'src/modules/resource/components/SquareAvatarCropModal.vue',
      resource_types: 'src/modules/resource/types/resource.types.ts',
      resource_module: 'src/modules/resource/resource.module.ts',
    },
  },
  hashes: {
    resourceApi_upload: 'web_res_api_upload_001',
    useResourceUpload_upload: 'web_res_hook_upload_002',
    SquareAvatarCropModal_confirm: 'web_res_cmp_avatar_crop_confirm_003',
  },
};
