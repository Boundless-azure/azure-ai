/**
 * @title IM Constants
 * @description Constants for IM module.
 * @keywords-cn 常量, IM配置, 默认值
 * @keywords-en constants, im-config, defaults
 */

export const IM_CONSTANTS = {
  SOCKET: {
    DEFAULT_PATH: '/api/socket.io',
    NAMESPACE: '/im',
    RECONNECTION_ATTEMPTS: 10,
    RECONNECTION_DELAY: 1500,
    TIMEOUT: 10000,
    TRANSPORTS: ['websocket'],
  },
  DEFAULTS: {
    LOCALHOST_ORIGIN: 'http://localhost:3001',
  },
};
