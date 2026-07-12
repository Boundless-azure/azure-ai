// AGENT-MONITOR-TEMP :: 临时调试监听, 后期整体删除 (grep AGENT-MONITOR-TEMP)
import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { CodeGraphMonitorGateway } from './controllers/code-graph-monitor.gateway';
import { CodeGraphMonitorService } from './services/code-graph-monitor.service';

/**
 * @title Code Graph 监听模块
 * @description 装配 code-agent 运行监听: 进程内进度枢纽服务 (注册全局 sink + 环形缓冲) + `/code-graph`
 *   WebSocket 网关 (鉴权 + 按 sessionId 房间 backfill/实时推送)。给监听页看每层节点与 LLM 调用进度。
 * @keyword-cn 监听模块, 装配
 * @keyword-en monitor-module, wiring
 */
@Module({
  imports: [AuthModule],
  providers: [CodeGraphMonitorService, CodeGraphMonitorGateway],
  exports: [CodeGraphMonitorService],
})
export class CodeGraphMonitorModule {}
