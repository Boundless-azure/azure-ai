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
    RECONNECTION_ATTEMPTS: Infinity,
    RECONNECTION_DELAY: 1000,
    RECONNECTION_DELAY_MAX: 10000,
    RANDOMIZATION_FACTOR: 0.5,
    TIMEOUT: 10000,
    TRANSPORTS: ['websocket'],
  },
  DEFAULTS: {
    LOCALHOST_ORIGIN: 'http://localhost:3001',
  },
};

/**
 * AI 待响应等待语 (per 队列执行实例随机一句, 整个生命周期保持不变)
 * 中文 / 粤语 / 英文 / 网络梗 混合, 多语种避免单调
 * @keyword-en ai-waiting-phrases queue-instance-phrase
 */
export const AI_WAITING_PHRASES: readonly string[] = [
  // 中文
  '稍等一下下~',
  '让我想想...',
  '小蓝整理中,马上来',
  '正在搬运答案,请勿催促',
  '让子弹飞一会儿~',
  // 粤语
  '帮紧你~帮紧你~',
  '做完你嗰啲就嚟做你嘅',
  '心急食唔到热豆腐~',
  '等阵阵,即刻啲',
  // 英文
  'Hang tight, on it~',
  'Brewing thoughts...',
  'Cooking the answer 🍳',
  'Lemme cook',
  // 网络梗
  '别催了别催了,在马了在马了',
  '你先别急,先别急',
  '稍微让我 emo 一下',
  '小蓝正在吟唱中... (5/9 法力值)',
  '加载中... 88% (玄学进度条)',
  '梦女正在为你加载...',
];

/**
 * AI 待响应 emoji (固定, 表示"AI 已识别")
 * @keyword-en ai-awaiting-emoji
 */
export const AI_AWAITING_EMOJI = '⏳';

/**
 * 从等待语池随机一句
 * @keyword-en pick-random-waiting-phrase
 */
export function pickWaitingPhrase(): string {
  const idx = Math.floor(Math.random() * AI_WAITING_PHRASES.length);
  return AI_WAITING_PHRASES[idx] ?? AI_WAITING_PHRASES[0]!;
}
