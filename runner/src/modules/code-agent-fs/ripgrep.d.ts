/**
 * @title @vscode/ripgrep 类型声明
 * @description `@vscode/ripgrep` 不自带 .d.ts, 这里补最小声明: `rgPath` 是随包附带的预编译 ripgrep 二进制
 *   绝对路径, `rgVersion` 是版本号。code-agent-fs 用它做内置的快速 tag 搜索, 并注入进终端 PATH。
 * @keyword-cn ripgrep声明, 二进制路径
 * @keyword-en ripgrep-declaration, rg-binary-path
 */
declare module '@vscode/ripgrep' {
  export const rgPath: string;
  export const rgVersion: string;
}
