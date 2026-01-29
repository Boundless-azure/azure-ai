/**
 * @title IM WebSocket Service
 * @description Socket.io client for IM beacon events and room management. Uses auth.token for handshake authentication.
 * @keywords-cn IM WebSocket, 信标, 房间管理, 增量拉取, 握手认证
 * @keywords-en im-websocket, beacon, room-management, incremental-pull, handshake-auth
 */

import { io, type Socket } from 'socket.io-client';
import type { ImMessageInfo } from '../../../api/im';
import { IM_CONSTANTS } from '../constants/im.constants';

// ========== Types ==========

export interface ImWsEvent {
  type: string;
  sessionId?: string;
  data?: unknown;
  error?: string;
}

export interface ImMessageEvent extends ImWsEvent {
  type: 'im:message';
  data: ImMessageInfo;
  sessionId: string;
}

export interface ImTypingEvent extends ImWsEvent {
  type: 'im:typing';
  data: { userId: string; isTyping: boolean };
  sessionId: string;
}

export interface ImMemberJoinedEvent extends ImWsEvent {
  type: 'im:member_joined';
  data: { principalId: string; displayName: string; role: string };
  sessionId: string;
}

export interface ImMemberLeftEvent extends ImWsEvent {
  type: 'im:member_left';
  data: { principalId: string };
  sessionId: string;
}

export interface AiStreamStartEvent extends ImWsEvent {
  type: 'ai:stream_start';
  sessionId: string;
  agentId: string;
}

export interface AiTokenEvent extends ImWsEvent {
  type: 'ai:token';
  data: { text: string };
  sessionId: string;
}

export interface AiStreamEndEvent extends ImWsEvent {
  type: 'ai:stream_end';
  sessionId: string;
  messageId: string;
}

export interface ImErrorEvent extends ImWsEvent {
  type: 'error';
  error: string;
  sessionId?: string;
}

export interface ImNewMessageBeaconPayload {
  sessionId: string;
  lastMessageId: string;
}

export type ImEvent =
  | ImMessageEvent
  | ImTypingEvent
  | ImMemberJoinedEvent
  | ImMemberLeftEvent
  | AiStreamStartEvent
  | AiTokenEvent
  | AiStreamEndEvent
  | ImErrorEvent;

export interface ImSocketCallbacks {
  onMessage?: (message: ImMessageInfo, sessionId: string) => void;
  onTyping?: (userId: string, isTyping: boolean, sessionId: string) => void;
  onMemberJoined?: (
    member: { principalId: string; displayName: string; role: string },
    sessionId: string,
  ) => void;
  onMemberLeft?: (principalId: string, sessionId: string) => void;
  onAiStreamStart?: (agentId: string, sessionId: string) => void;
  onAiToken?: (text: string, sessionId: string) => void;
  onAiStreamEnd?: (messageId: string, sessionId: string) => void;
  onNewMessageBeacon?: (payload: ImNewMessageBeaconPayload) => void;
  onError?: (error: string, sessionId?: string) => void;
  onUserPush?: (data: { sessionId: string }) => void;
}

// ========== Service ==========

export class ImSocketService {
  private socket: Socket | null = null;
  private callbacks: ImSocketCallbacks = {};
  private notifyAudio: HTMLAudioElement | null = null;
  private lastNotifyAt: number | null = null;

  private playNotifySound(): void {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    const now = Date.now();
    if (this.lastNotifyAt !== null && now - this.lastNotifyAt < 600) return;
    this.lastNotifyAt = now;

    if (!this.notifyAudio) {
      this.notifyAudio = new Audio('/message-notity.mp3');
      this.notifyAudio.preload = 'auto';
      this.notifyAudio.volume = 0.8;
    }

    try {
      this.notifyAudio.currentTime = 0;
    } catch {
      this.notifyAudio = new Audio('/message-notity.mp3');
      this.notifyAudio.preload = 'auto';
      this.notifyAudio.volume = 0.8;
    }

    const p = this.notifyAudio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => undefined);
    }
  }

  private getBaseWsUrl(): string {
    const envValue = import.meta.env?.PUBLIC_WS_BASE_URL;
    if (typeof envValue === 'string' && envValue.length > 0) {
      return envValue;
    }
    return typeof window !== 'undefined'
      ? window.location.origin
      : IM_CONSTANTS.DEFAULTS.LOCALHOST_ORIGIN;
  }

  private getSocketPath(): string {
    return IM_CONSTANTS.SOCKET.DEFAULT_PATH;
  }

  /**
   * Connect to IM WebSocket (auth via handshake token)
   */
  connect(token: string, callbacks: ImSocketCallbacks): void {
    if (this.socket?.connected) {
      this.disconnect();
    }

    this.callbacks = callbacks;
    console.log('[ImSocket] callbacks registered', {
      onUserPush: typeof callbacks.onUserPush === 'function',
      onNewMessageBeacon: typeof callbacks.onNewMessageBeacon === 'function',
      onMessage: typeof callbacks.onMessage === 'function',
      onTyping: typeof callbacks.onTyping === 'function',
      onMemberJoined: typeof callbacks.onMemberJoined === 'function',
      onMemberLeft: typeof callbacks.onMemberLeft === 'function',
      onAiStreamStart: typeof callbacks.onAiStreamStart === 'function',
      onAiToken: typeof callbacks.onAiToken === 'function',
      onAiStreamEnd: typeof callbacks.onAiStreamEnd === 'function',
    });

    const baseUrl = this.getBaseWsUrl();
    const path = this.getSocketPath();
    console.log('[ImSocket] Connecting', `${baseUrl}${path}`);
    this.socket = io(`${baseUrl}${IM_CONSTANTS.SOCKET.NAMESPACE}`, {
      path,
      transports: IM_CONSTANTS.SOCKET.TRANSPORTS,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: IM_CONSTANTS.SOCKET.RECONNECTION_ATTEMPTS,
      reconnectionDelay: IM_CONSTANTS.SOCKET.RECONNECTION_DELAY,
      timeout: IM_CONSTANTS.SOCKET.TIMEOUT,
      auth: { token },
    });

    this.socket.on('connect', () => {
      console.log('[ImSocket] Connected');
      this.joinNotify();
    });

    this.socket.on('connect_error', (err: Error) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ImSocket] Connect error', msg);
      this.callbacks.onError?.(msg, undefined);
    });

    this.socket.on('error', (err: Error) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ImSocket] Error', msg);
      this.callbacks.onError?.(msg, undefined);
    });

    this.socket.on('disconnect', () => {
      console.log('[ImSocket] Disconnected');
    });

    this.socket.on('im:event', (event: ImEvent) => {
      this.handleEvent(event);
    });

    this.socket.on(
      'session-room/new_message',
      (payload: ImNewMessageBeaconPayload) => {
        try {
          this.callbacks.onNewMessageBeacon?.(payload);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.callbacks.onError?.(msg);
        }
      },
    );

    this.socket.on('user-room/notify', (data: { sessionId: string }) => {
      this.playNotifySound();
      try {
        this.callbacks.onUserPush?.(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.callbacks.onError?.(msg);
      }
    });
  }

  /**
   * Join a session room
   */
  joinRoom(sessionId: string): void {
    console.log('[ImSocket] Join room', sessionId);
    this.socket?.emit('user-room/join-room', { sessionId });
  }

  joinNotify(): void {
    this.socket?.emit('user-room/join-notify');
  }

  /**
   * Leave a session room
   */
  leaveRoom(sessionId: string): void {
    console.log('[ImSocket] Leave room', sessionId);
    this.socket?.emit('user-room/leave-room', { sessionId });
  }

  leaveNotify(): void {
    this.socket?.emit('user-room/leave-notify');
  }

  joinSession(sessionId: string): void {
    this.joinRoom(sessionId);
  }

  leaveSession(sessionId: string): void {
    this.leaveRoom(sessionId);
  }

  /**
   * Send typing status
   */
  sendTyping(sessionId: string, isTyping: boolean): void {
    this.socket?.emit('im:typing', { sessionId, isTyping });
  }

  /**
   * Send read receipt
   */

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.leaveNotify();
      this.socket.disconnect();
      this.socket = null;
    }
    this.callbacks = {};
  }

  private handleEvent(event: ImEvent): void {
    switch (event.type) {
      case 'im:message':
        this.callbacks.onMessage?.(event.data, event.sessionId);
        break;
      case 'im:typing':
        this.callbacks.onTyping?.(
          event.data.userId,
          event.data.isTyping,
          event.sessionId,
        );
        break;
      case 'im:member_joined':
        this.callbacks.onMemberJoined?.(event.data, event.sessionId);
        break;
      case 'im:member_left':
        this.callbacks.onMemberLeft?.(event.data.principalId, event.sessionId);
        break;
      case 'ai:stream_start':
        this.callbacks.onAiStreamStart?.(event.agentId, event.sessionId);
        break;
      case 'ai:token':
        this.callbacks.onAiToken?.(event.data.text, event.sessionId);
        break;
      case 'ai:stream_end':
        this.callbacks.onAiStreamEnd?.(event.messageId, event.sessionId);
        break;
      case 'error':
        this.callbacks.onError?.(event.error, event.sessionId);
        break;
    }
  }
}

// Singleton instance
export const imSocketService = new ImSocketService();
