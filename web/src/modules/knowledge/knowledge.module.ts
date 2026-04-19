/**
 * @title 知识模块入口
 * @description 导出知识书本/章节 hooks、常量、类型，供外部统一引用。
 * @keywords-cn 知识模块, 导出, 入口
 * @keywords-en knowledge-module, exports, entry
 */
import { useKnowledge } from './hooks/useKnowledge';
import * as KnowledgeConstants from './constants/knowledge.constants';

export * from './types/knowledge.types';

export const KnowledgeModule = {
  name: 'KnowledgeModule',
  constants: KnowledgeConstants,
  hooks: { useKnowledge },
};
