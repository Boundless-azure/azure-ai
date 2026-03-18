/**
 * @title WebMCP 类型
 * @description 定义 runner 侧 WebMCP 描述缓存与操作分发类型。
 * @keywords-cn WebMCP类型, 页面描述, 操作分发
 * @keywords-en webmcp-types, page-descriptor, operation-dispatch
 */
export interface WebMcpDescriptor {
  page: string;
  descriptor: unknown;
  ts: number;
}

export interface WebMcpOperation {
  op: 'callHook' | 'setData';
  pointer?: string;
  page?: string;
  keyword?: string[];
  value?: unknown;
  args?: unknown;
}
