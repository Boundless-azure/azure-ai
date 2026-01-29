/**
 * @title WebMCP 模块入口
 * @description 导出 WebMCP hooks、常量与服务，供外部统一引用。
 * @keywords-cn 模块入口, WebMCP, 导出
 * @keywords-en module-entry, webmcp, exports
 */
import * as WebMcpConstants from './constants/webmcp.constants';
import { useWebMCP } from './hooks/useWebMCP';
import { moduleTip } from './description/module.tip';

export * from './types/webmcp.types';

export const WebMCPModule = {
  name: 'WebMCPModule',
  constants: WebMcpConstants,
  hooks: { useWebMCP },
  tip: moduleTip,
};
