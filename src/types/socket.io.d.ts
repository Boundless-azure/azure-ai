/**
 * @title Socket.io 类型扩展
 * @description 为 Socket 增加强类型的 data 字段，用于在连接生命周期存放主体等上下文。
 * @keywords-cn socket.io, 类型扩展, data, principalId
 * @keywords-en socket.io, type-augmentation, data, principalId
 */
declare module 'socket.io' {
  /**
   * Socket.data 强类型结构
   */
  interface SocketDataBase {
    principalId?: string;
    [key: string]: unknown;
  }

  interface Socket {
    /**
     * 用于在服务器端保存与该连接相关的上下文数据
     */
    data?: SocketDataBase;
  }
}

/**
 * @title 公共类型导出
 * @description 为业务代码提供统一可复用的 SocketData 类型别名。
 * @keywords-cn 公共类型, SocketData, principalId
 * @keywords-en public-types, SocketData, principalId
 */
export interface ImSocketData {
  principalId?: string;
  [key: string]: unknown;
}
