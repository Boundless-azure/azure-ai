/**
 * @title WebMCP Typings
 * @description Types for WebMCP page declaration, wire format, and operations.
 * @keywords-cn WebMCP类型, 页面声明, 线协议, 操作
 * @keywords-en webmcp-types, page-declaration, wire-protocol, operations
 */

export interface WebMcpDataItem {
  data: unknown;
  keyword: string[];
  desc: string;
}

export interface WebMcpHookItem {
  hookname: string;
  keyword: string[];
  action?: () => void | Promise<void>;
  desc: string;
}

export interface WebMcpPageDeclaration {
  page: string; // unique id
  desc: string;
  keyword: string[];
  childPage?: WebMcpPageDeclaration[];
  data?: WebMcpDataItem[];
  hook?: WebMcpHookItem[];
}

/** Wire (WS) safe format: functions converted to pointers */
export interface WebMcpWireHookItem {
  hookname: string;
  keyword: string[];
  pointer: string; // resolved from page + hookname
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

/** Operation JSON sent by AI/backend to the page */
export type WebMcpOperation =
  | {
      op: 'callHook';
      pointer: string;
      args?: unknown;
    }
  | {
      op: 'setData';
      page: string;
      keyword: string[];
      value: unknown;
      path?: string; // optional deep path within data item
    };

export interface WebMcpDescriptorRequest {
  page?: string; // optional page id filter
}

export interface WebMcpDescriptorResponse {
  page: string;
  descriptor: WebMcpWirePageDeclaration;
  ts: number;
}

export interface WebMcpOpResult {
  ok: boolean;
  pointer?: string;
  error?: string;
}
