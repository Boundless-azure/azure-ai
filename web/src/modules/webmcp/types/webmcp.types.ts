/**
 * @title WebMCP Types (Web)
 * @description Front-end typings for WebMCP page declaration and operations.
 * @keywords-cn WebMCP前端类型, 页面声明, 操作
 * @keywords-en webmcp-web-types, page-declaration, operations
 */

export interface WebMcpDataItem {
  data: unknown;
  keyword: string[];
  desc: string;
}

export interface WebMcpHookItem {
  hookname: string;
  keyword: string[];
  action: () => void | Promise<void>;
  desc: string;
}

export interface WebMcpPageDeclaration {
  page: string;
  desc: string;
  keyword: string[];
  childPage?: WebMcpPageDeclaration[];
  data?: WebMcpDataItem[];
  hook?: WebMcpHookItem[];
}

export interface WebMcpWireHookItem {
  hookname: string;
  keyword: string[];
  pointer: string;
  desc: string;
}

export interface WebMcpWirePageDeclaration {
  page: string;
  desc: string;
  keyword: string[];
  childPage?: WebMcpWirePageDeclaration[];
  data?: WebMcpDataItem[];
  hook?: WebMcpWireHookItem[];
}

export type WebMcpOperation =
  | { op: 'callHook'; pointer: string; args?: unknown }
  | {
      op: 'setData';
      page: string;
      keyword: string[];
      value: unknown;
      path?: string;
    };

export interface WebMcpOpResult {
  ok: boolean;
  pointer?: string;
  error?: string;
}
