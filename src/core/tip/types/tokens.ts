// 独立的注入令牌，避免 tip.module 与 tip.service/tip.generator 之间的循环依赖
export const TIP_OPTIONS = 'TIP_OPTIONS' as const;
