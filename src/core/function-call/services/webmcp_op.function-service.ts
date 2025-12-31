import { Injectable } from '@nestjs/common';
import { tool } from 'langchain';
import type { FunctionCallServiceContract } from '../types/service.types';
import { WebMcpOperationFunctionDescription } from '../descriptions/webmcp/op';
import { z } from 'zod';
import { WebMcpService } from '@/app/webmcp/services/webmcp.service';

/**
 * @title WebMCP Operation Function Service
 * @desc 提供 webmcp_op 函数句柄：下发操作 JSON 到页面并返回回执。
 * @keywords-cn WebMCP函数, webmcp_op, 操作下发
 * @keywords-en webmcp-function, webmcp_op, dispatch-operation
 */
@Injectable()
export class WebMcpOperationFunctionService implements FunctionCallServiceContract {
  constructor(private readonly webmcp: WebMcpService) {}

  getHandle() {
    const CallHookSchema = z.object({
      op: z.literal('callHook'),
      pointer: z.string().min(1),
      args: z.any().optional(),
    });
    const SetDataSchema = z.object({
      op: z.literal('setData'),
      page: z.string().min(1),
      keyword: z.array(z.string().min(1)).min(1),
      value: z.any(),
      path: z.string().optional(),
    });
    const schema = z.union([CallHookSchema, SetDataSchema]);

    return tool(
      async (input: z.infer<typeof schema>): Promise<string> => {
        const result = await this.webmcp.dispatchOperation(input);
        return JSON.stringify(result);
      },
      {
        name: WebMcpOperationFunctionDescription.name,
        description: WebMcpOperationFunctionDescription.description,
        schema,
      },
    );
  }
}
