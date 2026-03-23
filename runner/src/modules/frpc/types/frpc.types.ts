/**
 * @title FRPC 类型定义
 * @description FRP Client 配置相关类型。
 * @keywords-cn FRPC类型, 配置, 类型定义
 * @keywords-en frpc-types, config, type-definitions
 */
export interface FrpcConfig {
  serverAddr: string;
  serverPort: number;
  authMethod: string;
  token: string;
  proxies: FrpcProxy[];
}

export interface FrpcProxy {
  name: string;
  type: string;
  localIp: string;
  localPort: number;
  customDomains: string[];
}
