/**
 * @title Storage Constants
 * @description Storage module constants
 * @keywords-cn 存储常量, 资源库常量
 * @keywords-en storage-constants, resource-library-constants
 */

export const STORAGE_NODE_TYPE = {
  FOLDER: 'folder',
  FILE: 'file',
} as const;

export const SHARE_MODE = {
  NONE: 'none',
  TEMP: 'temp',
  PERMANENT: 'permanent',
  PASSWORD: 'password',
} as const;

export const SHARE_MODE_LABEL = {
  [SHARE_MODE.NONE]: '不分享',
  [SHARE_MODE.TEMP]: '临时分享',
  [SHARE_MODE.PERMANENT]: '永久分享',
  [SHARE_MODE.PASSWORD]: '密码分享',
} as const;
