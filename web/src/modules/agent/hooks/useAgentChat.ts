/**
 * @title useAgentChat
 * @description 发送消息与会话(thread)消息的组合函数；与 useAgentSessions/useAgentThreads 可互相调用。
 * @keywords-cn 聊天, 发送消息, 会话消息, 线程消息
 * @keywords-en chat, send-message, session-message, thread-message
 */
import { ref } from 'vue';
import { agentApi } from '../../../api/agent';
import type { BaseResponse } from '../../../utils/types';
import type { ChatMessage } from '../types/agent.types';
import { ChatRole } from '../enums/agent.enums';

export function useAgentChat() {
  const sending = ref(false);
  const lastMessage = ref<ChatMessage | null>(null);
  const error = ref<string | null>(null);

  async function send(content: string, sessionId?: string) {
    sending.value = true;
    error.value = null;
    try {
      const res: BaseResponse<{
        sessionId: string;
        message: string;
        model: string;
        tokensUsed?: { prompt: number; completion: number; total: number };
      }> = await agentApi.sendMessage(content, sessionId);
      const now = Date.now();
      const msg: ChatMessage = {
        id: `${res.data.sessionId}-${now}`,
        role: ChatRole.Assistant,
        content: res.data.message,
        timestamp: now,
        tool_calls: [],
      };
      lastMessage.value = msg;
      return msg;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'send message failed';
      throw e;
    } finally {
      sending.value = false;
    }
  }

  async function sendToThread(
    threadId: string,
    content: string,
    sessionId?: string,
  ) {
    sending.value = true;
    error.value = null;
    try {
      const res: BaseResponse<{
        sessionId: string;
        message: string;
        model: string;
        tokensUsed?: { prompt: number; completion: number; total: number };
      }> = await agentApi.postThreadMessage(threadId, content, sessionId);
      const now = Date.now();
      const msg: ChatMessage = {
        id: `${res.data.sessionId}-${now}`,
        role: ChatRole.Assistant,
        content: res.data.message,
        timestamp: now,
        tool_calls: [],
      };
      lastMessage.value = msg;
      return msg;
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : 'send thread message failed';
      throw e;
    } finally {
      sending.value = false;
    }
  }

  return { sending, lastMessage, error, send, sendToThread };
}
