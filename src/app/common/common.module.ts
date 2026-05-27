import { Module } from '@nestjs/common';
import { CommonComponentsService } from './services/common-components.service';

/**
 * @title Common 模块
 * @description 跨业务公共能力：公共 Web Component Hook 声明（统计看板等）。
 * @keywords-cn 公共模块, 统计看板组件, Web组件
 * @keywords-en common-module, count-board-component, web-component
 */
@Module({
  providers: [CommonComponentsService],
})
export class CommonModule {}
