import { tool } from 'langchain';
import z from 'zod';

export default class AgentHandleClass {
  handleTool() {
    const resultZod = z.object({
      op: z.literal('callHook'),
      pointer: z.string().min(1),
      args: z.any().optional(),
    });
    return tool(() => {}, {
      name: '代码生成编排工具',
      description:
        '根据用户描述生成插件,会逐步生成说明文档,然后生成对应实体,最后生成插件代码',
      schema: resultZod,
    });
  }
}
