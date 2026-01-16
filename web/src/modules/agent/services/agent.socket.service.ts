/**
 * @title Agent WebSocket Service
 * @description Socket.io client for streaming AI conversation events, including tool calls.
 * @keywords-cn 代理对话, WebSocket, 流式, 工具调用
 * @keywords-en agent-conversation, websocket, streaming, tool-calls
 */

import { io, type Socket } from 'socket.io-client';
import { useUIStore } from '../store/ui.store';

export interface ChatStartPayload {
  message: string;
  chatClientId: string;
  sessionId?: string;
  modelId?: string;
  systemPrompt?: string;
  stream?: boolean;
  threadType?: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
}

/**
 * @title ThreadChatStartPayload
 * @description 线程对话启动载荷；由服务端根据 threadId 复用/创建并绑定会话。
 * @keywords-cn 线程对话, 启动载荷, WebSocket
 * @keywords-en thread-chat, start-payload, websocket
 */
export interface ThreadChatStartPayload {
  threadId: string;
  message: string;
  sessionId?: string;
  modelId?: string;
  systemPrompt?: string;
  stream?: boolean;
}

export type ConversationEvent =
  | { type: 'token'; data: { text: string }; sessionId?: string }
  | { type: 'reasoning'; data: { text: string }; sessionId?: string }
  | {
      type: 'tool_start';
      data: { name: string; input?: unknown; id?: string };
      sessionId?: string;
    }
  | {
      type: 'tool_chunk';
      data: { id?: string; name?: string; args?: unknown; index?: number };
      sessionId?: string;
    }
  | {
      type: 'tool_end';
      data: { name?: string; output?: unknown; id?: string };
      sessionId?: string;
    }
  | {
      type: 'session_group';
      data: { sessionGroupId: string; date: string; chatClientId: string };
      sessionId?: string;
    }
  | {
      type: 'session_group_title';
      data: { sessionGroupId: string; title: string };
      sessionId?: string;
    }
  | { type: 'done'; sessionId?: string }
  | { type: 'error'; error: string; sessionId?: string };

export interface AgentStreamCallbacks {
  onToken?(text: string, sessionId?: string): void;
  onReasoning?(text: string, sessionId?: string): void;
  onToolStart?(
    data: { name: string; input?: unknown; id?: string },
    sessionId?: string,
  ): void;
  onToolChunk?(
    data: { id?: string; name?: string; args?: unknown; index?: number },
    sessionId?: string,
  ): void;
  onToolEnd?(
    data: { name?: string; output?: unknown; id?: string },
    sessionId?: string,
  ): void;
  onSessionGroup?(
    data: { sessionGroupId: string; date: string; chatClientId: string },
    sessionId?: string,
  ): void;
  onSessionGroupTitle?(
    data: { sessionGroupId: string; title: string },
    sessionId?: string,
  ): void;
  onDone?(sessionId?: string): void;
  onError?(error: string, sessionId?: string): void;
}

export class AgentSocketService {
  private socket: Socket | null = null;

  private getBaseWsUrl(): string {
    const envValue = (import.meta as { env?: Record<string, unknown> }).env?.[
      'PUBLIC_WS_BASE_URL'
    ];
    if (typeof envValue === 'string' && envValue.length > 0) {
      return envValue;
    }
    return window.location.origin;
  }

  private ensureSocket(): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }
    const baseUrl = this.getBaseWsUrl();
    this.socket = io(`${baseUrl}/conversation/ws`, {
      path: '/api/socket.io',
      transports: ['websocket'],
      withCredentials: true,
    });

    this.socket.on('connect_error', (err) => {
      const uiStore = useUIStore();
      uiStore.showToast(`Socket Connection Error: ${err.message}`, 'error');
    });
    return this.socket;
  }

  public startChat(
    payload: ChatStartPayload,
    callbacks: AgentStreamCallbacks,
  ): void {
    const socket = this.ensureSocket();

    const handler = (ev: ConversationEvent) => {
      if (ev.type === 'token') {
        callbacks.onToken?.(ev.data.text, ev.sessionId);
      } else if (ev.type === 'reasoning') {
        callbacks.onReasoning?.(ev.data.text, ev.sessionId);
      } else if (ev.type === 'tool_start') {
        callbacks.onToolStart?.(ev.data, ev.sessionId);
      } else if (ev.type === 'tool_chunk') {
        callbacks.onToolChunk?.(ev.data, ev.sessionId);
      } else if (ev.type === 'tool_end') {
        callbacks.onToolEnd?.(ev.data, ev.sessionId);
      } else if (ev.type === 'session_group') {
        callbacks.onSessionGroup?.(ev.data, ev.sessionId);
      } else if (ev.type === 'session_group_title') {
        callbacks.onSessionGroupTitle?.(ev.data, ev.sessionId);
      } else if (ev.type === 'done') {
        callbacks.onDone?.(ev.sessionId);
        socket.off('conversation_event', handler);
      } else if (ev.type === 'error') {
        callbacks.onError?.(ev.error, ev.sessionId);
        socket.off('conversation_event', handler);
      }
    };

    socket.on('conversation_event', handler);
    socket.emit('chat_start', payload);
  }

  /**
   * @title 启动线程内流式对话
   * @description 发送 thread_chat_start 事件并消费服务端返回的统一会话事件。
   * @keywords-cn 线程对话, WebSocket, 流式
   * @keywords-en thread-conversation, websocket, streaming
   */
  public startThreadChat(
    payload: ThreadChatStartPayload,
    callbacks: AgentStreamCallbacks,
  ): void {
    const socket = this.ensureSocket();

    const handler = (ev: ConversationEvent) => {
      if (ev.type === 'token') {
        callbacks.onToken?.(ev.data.text, ev.sessionId);
      } else if (ev.type === 'reasoning') {
        callbacks.onReasoning?.(ev.data.text, ev.sessionId);
      } else if (ev.type === 'tool_start') {
        callbacks.onToolStart?.(ev.data, ev.sessionId);
      } else if (ev.type === 'tool_chunk') {
        callbacks.onToolChunk?.(ev.data, ev.sessionId);
      } else if (ev.type === 'tool_end') {
        callbacks.onToolEnd?.(ev.data, ev.sessionId);
      } else if (ev.type === 'session_group') {
        callbacks.onSessionGroup?.(ev.data, ev.sessionId);
      } else if (ev.type === 'session_group_title') {
        callbacks.onSessionGroupTitle?.(ev.data, ev.sessionId);
      } else if (ev.type === 'done') {
        callbacks.onDone?.(ev.sessionId);
        socket.off('conversation_event', handler);
      } else if (ev.type === 'error') {
        callbacks.onError?.(ev.error, ev.sessionId);
        socket.off('conversation_event', handler);
      }
    };

    socket.on('conversation_event', handler);
    socket.emit('thread_chat_start', payload);
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const agentSocketService = new AgentSocketService();
