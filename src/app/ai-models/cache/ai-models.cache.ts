/**
 * @title AI模型缓存定义
 * @description AI模型相关缓存键与前缀定义。
 * @keywords-cn AI模型缓存, 缓存键, 前缀
 * @keywords-en ai-model-cache, cache-keys, prefix
 */
export const AI_MODEL_CACHE_KEYS = {
  list: 'ai-models:list',
  detail: (id: string) => `ai-models:detail:${id}`,
};
