declare module 'socket.io' {
  export interface ServerOptions {
    path?: string;
    cors?: { origin?: string | string[]; methods?: string[] } | boolean;
  }

  export interface BroadcastOperator {
    emit(event: string, ...args: any[]): boolean;
  }

  export class Server {
    constructor(httpServer?: any, opts?: ServerOptions);
    emit(event: string, ...args: any[]): boolean;
    to(room: string): BroadcastOperator;
    in(room: string): BroadcastOperator;
  }

  export interface Handshake {
    query: Record<string, string | string[] | undefined>;
    headers: Record<string, string | undefined>;
    auth: Record<string, any>;
  }

  export class Socket {
    id: string;
    handshake: Handshake;
    emit(event: string, ...args: any[]): boolean;
    join(room: string | string[]): Promise<void> | void;
    leave(room: string): Promise<void> | void;
    rooms: Set<string>;
  }
}
