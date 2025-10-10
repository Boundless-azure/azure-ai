# Prompt 模块

提供针对 Prompt 模板的渲染能力：

- 支持 JS 模板语法 `${expr}`。
- 支持数组渲染（helpers.renderList(list, itemTemplate)）。
- 支持传值渲染（直接在表达式中访问 data 的字段）。
- 支持函数渲染（通过注册 helpers 并在表达式中调用）。
- 提供严格的 JSON-only 输出能力（renderToJson）。

示例：

```ts
// 1) 普通字符串渲染
const text = promptService.renderString(
  'Hello, ${user.name}! Today is ${formatDate(Date.now())}.',
  { user: { name: 'Azure' } }
);

// 2) 数组渲染
const listText = promptService.renderString(
  'Users: ${renderList(users, "${item.name}(${index}) ")}',
  { users: [{ name: 'Alice' }, { name: 'Bob' }] }
);

// 3) JSON-only 输出
const json = promptService.renderToJson(
  '{"user": {"name": "${user.name}"}, "tags": ${toJson(tags)}}',
  { user: { name: 'Azure' }, tags: ['a', 'b'] }
);
```

安全注意事项：

- 表达式中禁止出现高风险标识符（this/global/process/require/Function/constructor/eval/class/import 等）。
- 渲染器采用 `with(scope) + Function` 的方式进行受限求值，请仅在受信任的模板与数据来源中使用，如需更强安全性建议接入更严格的表达式解析器。