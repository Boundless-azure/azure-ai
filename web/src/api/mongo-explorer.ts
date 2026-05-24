/**
 * @title MongoExplorer API
 * @description MongoDB Explorer module API calls (via Runner WebSocket)
 * @keywords-cn MongoDB浏览器API, Runner WebSocket API
 * @keywords-en mongo-explorer-api, runner-websocket-api
 * @note MongoDB 查询功能需要 Runner 支持 WebSocket MongoDB 代理协议
 */
import { http } from '../utils/http';

interface BaseResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// Runner 列表项
export interface RunnerWithMongo {
  id: string;
  alias: string;
  status: string;
}

// 获取可用的 Runner 列表
export async function getRunnersWithMongo(): Promise<{ success: boolean; data: RunnerWithMongo[] }> {
  const res = await http.get<BaseResponse<RunnerWithMongo[]>>('/mongo-explorer/runners');
  return res.data;
}
