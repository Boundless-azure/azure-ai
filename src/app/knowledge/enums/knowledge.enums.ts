/**
 * @title 知识模块枚举
 * @description 知识书本类型枚举。
 * @keywords-cn 知识枚举, 书本类型, 技能, 学识
 * @keywords-en knowledge-enums, book-type, skill, lore
 */

export enum KnowledgeBookType {
  /** 技能：描述如何操作对应的 hook 能力 */
  SKILL = 'skill',
  /** 学识：描述具体思路或直接录入的书本知识 */
  LORE = 'lore',
}
