/**
 * @title AgentRuntime 模块提示
 * @description 提供关键词到文件名与函数哈希的映射，以及模块功能描述。
 * @keywords-cn 模块描述, 关键词映射, 函数哈希
 * @keywords-en module-description, keyword-mapping, function-hash
 */
export const moduleTip = {
  description:
    '核心 AgentRuntime 模块提供按目录动态加载 Agent（desc/handle/dialogues），并支持在当前对话层接入对话或返回工具集合供主对话使用。',
  keywords: {
    cn: {
      动态加载服务: 'services/agent-loader.service.ts',
      运行时服务: 'services/agent-runtime.service.ts',
      控制器: 'controller/agent-runtime.controller.ts',
      类型定义: 'types/agent-runtime.types.ts',
      枚举: 'enums/agent-runtime.enums.ts',
      轻量实体: 'entities/agent-runtime.entity.ts',
      缓存: 'cache/agent-runtime.cache.ts',
      模块定义: 'agent-runtime.module.ts',
    },
    en: {
      loader_service: 'services/agent-loader.service.ts',
      runtime_service: 'services/agent-runtime.service.ts',
      controller: 'controller/agent-runtime.controller.ts',
      types: 'types/agent-runtime.types.ts',
      enums: 'enums/agent-runtime.enums.ts',
      entity: 'entities/agent-runtime.entity.ts',
      cache: 'cache/agent-runtime.cache.ts',
      module: 'agent-runtime.module.ts',
    },
  },
  hashMap: {
    resolveAgentDir: 'hash_runtime_resolve_dir_001',
    importDefaultFromTs: 'hash_runtime_import_default_002',
    loadDescriptor: 'hash_runtime_load_desc_003',
    loadHandleTools: 'hash_runtime_load_handle_004',
    loadDialogues: 'hash_runtime_load_dialogues_005',
    loadAll: 'hash_runtime_load_all_006',
    attachDialogue: 'hash_runtime_attach_dialogue_007',
    startDialogue: 'hash_runtime_start_dialogue_008',
    getTools: 'hash_runtime_get_tools_009',
  },
};
