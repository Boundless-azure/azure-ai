/**
 * @title WebMCP Module Tip (Web)
 * @description 前端 WebMCP 模块的关键词映射与函数哈希对照。
 * @keywords-cn 模块描述, 关键词映射, 哈希对照
 * @keywords-en module-description, keyword-mapping, hash-map
 */

export const moduleTip = {
  description: 'WebMCP 前端模块提供页面声明、Socket 握手与操作分发的能力。',
  keywords: {
    cn: {
      类型: 'src/modules/webmcp/types/webmcp.types.ts',
      组合函数: 'src/modules/webmcp/hooks/useWebMCP.ts',
      常量: 'src/modules/webmcp/constants/webmcp.constants.ts',
    },
    en: {
      types: 'src/modules/webmcp/types/webmcp.types.ts',
      hooks: 'src/modules/webmcp/hooks/useWebMCP.ts',
      constants: 'src/modules/webmcp/constants/webmcp.constants.ts',
    },
  },
  hashMap: {
    declarePage: 'hash_hook_declarePage_001',
    connect: 'hash_hook_connect_002',
    registerCurrentPage: 'hash_hook_registerCurrentPage_003',
    useWebMCP: 'hash_hook_use_webmcp_004',
  },
};
