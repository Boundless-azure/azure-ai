declare module '@nestjs/websockets' {
  export const WebSocketGateway: any;
  export const WebSocketServer: any;
  export function SubscribeMessage(event: string): any;
  export function MessageBody(): any;
  export function ConnectedSocket(): any;
  export type OnGatewayInit = object;
  export type OnGatewayConnection = object;
  export type OnGatewayDisconnect = object;
}

declare module '@nestjs/platform-socket.io' {
  export class IoAdapter {
    constructor(app: any);
  }
}

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
