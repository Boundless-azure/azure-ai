declare module 'socket.io' {
  export interface ServerOptions {
    path?: string;
    cors?: { origin?: string | string[]; methods?: string[] } | boolean;
  }
  export class Server {
    constructor(httpServer?: any, opts?: ServerOptions);
    emit(event: string, ...args: any[]): boolean;
  }
  export class Socket {
    emit(event: string, ...args: any[]): boolean;
  }
}
