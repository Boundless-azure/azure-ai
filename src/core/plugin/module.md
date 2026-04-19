模块名称：core/plugin（Apps/AppUnit 元信息与录入模块）

概述
- apps：负责应用信息的入库（session_id、name、version、description、hooks、embedding、keywords）、关键词生成（AI）、以及基础的增删改查接口。
- app_units：负责应用子单元（CRM 子模块等）的入库（session_id、app_id、name、description、embedding、keywords）与 CRUD。
- apps 录入流程通过读取指定目录的 plugin.conf.ts（纯数据对象，默认导出），生成关键词并 upsert 至数据库。

文件清单（File List）
- core/plugin/types.ts
- core/plugin/types/app-unit.types.ts
- core/plugin/entities/plugin.entity.ts
- core/plugin/entities/app-unit.entity.ts
- core/plugin/services/plugin.keywords.service.ts
- core/plugin/services/plugin.service.ts
- core/plugin/services/app-unit.service.ts
- core/plugin/controllers/plugin.controller.ts
- core/plugin/controllers/app-unit.controller.ts
- core/plugin/plugin.module.ts

函数清单（Function Index）
- PluginKeywordsService
  - method: generateKeywords
  - method: pickDefaultModelId
  - method: buildPrompt (private)
  - method: safeParseKeywords (private)
  - method: normalize (private)
- PluginService
  - method: list
  - method: get
  - method: delete
  - method: registerByDir
  - method: update
  - method: loadConfig (private)
- AppUnitService
  - method: list
  - method: get
  - method: create
  - method: update
  - method: delete
- PluginController
  - method: list (GET /plugin)
  - method: get (GET /plugin/:id)
  - method: register (POST /plugin/register)
  - method: update (PUT /plugin/:id)
  - method: delete (DELETE /plugin/:id)
- AppUnitController
  - method: list (GET /app-unit)
  - method: get (GET /app-unit/:id)
  - method: create (POST /app-unit)
  - method: update (PUT /app-unit/:id)
  - method: delete (DELETE /app-unit/:id)

文件说明
- types.ts：约定 PluginConfig、HookDescriptor、PluginHookTuple，以及校验方法。
- entities/plugin.entity.ts：apps 实体（兼容导出 PluginEntity），包含 session_id/embedding/keywords。
- entities/app-unit.entity.ts：app_units 实体，包含 session_id/app_id/embedding/keywords。
- plugin.keywords.service.ts：关键词生成服务，依赖 AIModelService。
- plugin.service.ts：apps 录入流程与 CRUD（兼容保留 PluginService 名称）。
- app-unit.service.ts：app_units CRUD。
- plugin.controller.ts：apps（兼容保留 /plugin 路由）接口。
- app-unit.controller.ts：app_units 接口。
- plugin.module.ts：模块声明，集成 TypeORM 与 AI Core。

关键词索引（中文 / English Keyword Index）
core/plugin/types.ts
core/plugin/types/app-unit.types.ts
core/plugin/entities/plugin.entity.ts
core/plugin/entities/app-unit.entity.ts
core/plugin/services/plugin.keywords.service.ts
core/plugin/services/plugin.service.ts
core/plugin/services/app-unit.service.ts
core/plugin/controllers/plugin.controller.ts
core/plugin/controllers/app-unit.controller.ts
core/plugin/plugin.module.ts
PluginKeywordsService
PluginService
AppUnitService
PluginController
AppUnitController
PluginModule

快速检索映射（Keywords -> Files）
- "plugin.types" / "types.ts" -> core/plugin/types.ts
- "PluginEntity" -> core/plugin/plugin.entity.ts
- "PluginKeywordsService" -> core/plugin/plugin.keywords.service.ts
- "PluginService" -> core/plugin/plugin.service.ts
- "PluginController" -> core/plugin/plugin.controller.ts
- "PluginModule" -> core/plugin/plugin.module.ts

#problems_and_diagnostics
- [info] 录入时请确保 plugin.conf.ts 默认导出纯数据对象（export default），避免运行时转译失败。
- [warning] 若关键词为空或较少，请补充 description 与 hook 的 payloadDescription；同时确认至少有一个启用的 AI 模型。
- [info] 数据库存储：hooks 为 JSON 字符串；keywords_zh/keywords_en 为逗号分隔文本，便于 FULLTEXT 检索。
- [warning] 目录传参必须为相对项目根的有效路径（例如 plugins/<plugin-name>），否则 /plugin/register 会失败。
