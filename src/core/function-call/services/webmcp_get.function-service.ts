import { Injectable } from '@nestjs/common';
import { tool } from 'langchain';
import type { FunctionCallServiceContract } from '../types/service.types';
import { GetWebMcpFunctionDescription } from '../descriptions/webmcp/get';
import type { ZodTypeAny } from 'zod';
import { z } from 'zod';
import { WebMcpService } from '@/app/webmcp/services/webmcp.service';

/**
 * @title WebMCP Function Service
 * @desc 提供 getWebmcp 函数句柄：从前端拉取页面声明（可选按 page 过滤）。
 * @keywords-cn WebMCP函数, getWebmcp, 页面声明
 * @keywords-en webmcp-function, getWebmcp, page-descriptor
 */
@Injectable()
export class WebMcpFunctionService implements FunctionCallServiceContract {
  constructor(private readonly webmcp: WebMcpService) {}

  getHandle() {
    const schema: ZodTypeAny = z.object({ page: z.string().optional() });
    const handle = tool(
      async ({ page }: { page?: string }): Promise<string> => {
        const resp = await this.webmcp.requestDescriptor({ page });
        const obj: Record<string, unknown> = resp
          ? { page: resp.page, descriptor: resp.descriptor, ts: resp.ts }
          : { page: page ?? '', descriptor: null, ts: Date.now() };
        return JSON.stringify(obj);
      },
      {
        name: GetWebMcpFunctionDescription.name,
        description: GetWebMcpFunctionDescription.description,
        schema,
      },
    );
    return handle as unknown as ReturnType<
      FunctionCallServiceContract['getHandle']
    >;
  }
}
