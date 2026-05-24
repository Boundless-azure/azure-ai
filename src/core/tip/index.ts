/**
 * Tip 模块统一导出文件（barrel）：
 * - 模块：TipModule
 * - 控制器：TipController
 * - 服务：TipService、TipGeneratorService
 * - 类型：Tip*（见 types/index.ts）与 TIP_OPTIONS（见 types/tokens.ts）
 *
 * 建议外部模块仅从此入口导入，避免依赖内部子路径造成结构变更的影响。
 */
export * from './tip.module';
export * from './controllers/tip.controller';
export * from './services/tip.service';
export * from './services/tip.generator';
export * from './types';
export * from './types/tokens';
