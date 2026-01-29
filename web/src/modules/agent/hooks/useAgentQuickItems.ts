/**
 * @title useAgentQuickItems
 * @description 快捷面板条目的组合函数（静态源，可按需改为动态）。
 * @keywords-cn 快捷项, 面板, 资源, 待办, 通知
 * @keywords-en quick-items, panel, resource, todo, notification
 */
import { ref } from 'vue';
import type { QuickItem } from '../types/agent.types';
import { QuickItemType } from '../enums/agent.enums';

export function useAgentQuickItems() {
  const items = ref<QuickItem[]>([
    { id: '1', title: 'Check Email', icon: 'envelope', type: QuickItemType.Todo },
    { id: '2', title: 'System Update', icon: 'bell', type: QuickItemType.Notification },
    { id: '3', title: 'Knowledge Base', icon: 'book', type: QuickItemType.Resource },
    { id: '4', title: 'API Docs', icon: 'code', type: QuickItemType.Resource },
  ]);

  return { items };
}

