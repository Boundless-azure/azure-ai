/**
 * @title FRPC 类型定义
 * @description FRP Client 配置相关类型，使用 TOML 格式 (frp v0.50+)。
 * @keywords-cn FRPC类型, 配置, 类型定义
 * @keywords-en frpc-types, config, type-definitions
 */
export interface FrpcConfig {
  /** frps 服务器地址 */
  serverAddr: string;
  /** frps 服务器端口 (默认 7000) */
  serverPort: number;
  /** frps 认证 token (来自 frp_node.token) */
  serverToken: string;
  /** runner 明文 key，写入 metadata 供 frps plugin 鉴权 */
  runnerKey: string;
  /** saas 分配的 remote 穿透端口 */
  admissionPort: number;
  /** 本地指向的端口（通常是 caddy 的 80） */
  localPort?: number;
  /** frpc 管理 API 端口 */
  adminPort?: number;
  proxies?: FrpcProxy[];
}

export interface FrpcProxy {
  name: string;
  type: string;
  localIp: string;
  localPort: number;
  remotePort: number;
}
