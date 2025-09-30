# 开发环境配置指南

## 快速启动

### 1. 启动基础服务
```bash
# 使用启动脚本（推荐）
./start-dev.sh

# 或者手动启动
docker-compose up -d
```

### 2. 启动应用
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run start:dev
```

## 服务配置

### MySQL 数据库
- **主机**: localhost
- **端口**: 3306
- **数据库**: azure_ai_dev
- **用户名**: azure_ai_user
- **密码**: azure_ai_password

### Redis 缓存
- **主机**: localhost
- **端口**: 6379

## 环境变量

主要环境变量配置在 `.env` 文件中：

```env
# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=azure_ai_user
DB_PASSWORD=azure_ai_password
DB_DATABASE=azure_ai_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Docker 命令

```bash
# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重新构建
docker-compose build --no-cache
```

## 数据库初始化

MySQL 初始化脚本会自动执行，创建以下表：
- `ai_models` - AI 模型配置表
- `prompt_templates` - 提示模板表
- `chat_sessions` - 聊天会话表

## 验证安装

1. **检查 MySQL 连接**:
   ```bash
   mysql -h localhost -u azure_ai_user -p azure_ai_dev
   ```

2. **检查 Redis 连接**:
   ```bash
   redis-cli ping
   ```

3. **检查应用运行**:
   访问: http://localhost:3000

## 故障排除

### MySQL 连接失败
- 确保 Docker 服务正在运行
- 检查端口 3306 是否被占用
- 查看 MySQL 日志: `docker-compose logs mysql`

### Redis 连接失败
- 检查端口 6379 是否被占用
- 查看 Redis 日志: `docker-compose logs redis`

### 应用启动失败
- 检查环境变量配置
- 确保所有依赖已安装: `npm install`
- 查看应用日志
## Tip 模块：诊断与修复指引

本节说明如何使用 Tip 模块的 HTTP 端点进行诊断，并根据输出修复问题。

### 1. 启动服务

确保应用已启动：

```
npm start
```

应用默认监听在 `PORT=3000`。如需修改，在 `.env` 中设置 `PORT`。

### 2. 执行诊断

获取诊断：

```
GET http://localhost:3000/tip/diagnostics
```

诊断将包含：
- 缺失的索引段落（文件列表/函数索引/关键词索引/快速检索映射）
- 旧供应商引用（如 azure-openai）
- 每条问题的修复建议

### 3. 自动生成 AI 模块 tip

快速生成：

```
POST http://localhost:3000/tip/generate-ai
```

或自定义目录：

```
POST http://localhost:3000/tip/generate
Body: { "dir": "src/core/ai", "writeToFile": true }
```

### 4. 数据库与枚举对齐（修复 azure-openai）

执行迁移以移除旧的 `azure-openai` 记录，并将 `provider` 枚举更新为支持 `openai, anthropic, google, gemini, deepseek`：

```
npm run typeorm migration:run
```

新增迁移：`src/migrations/1759131399018-AlignProviders.ts`
- 删除 `ai_models` 表中所有 `azure-openai` 记录
- 修改枚举，移除 `azure-openai`，新增 `gemini/deepseek`
- 清理不在新枚举范围内的遗留值

若使用 DataSource 手动运行迁移，请参考 TypeORM 官方文档配置。

### 5. 常见问题排查

- 无法连接到 http://localhost:3000：
  - 确认服务已启动且未报错（查看终端日志）
  - 检查数据库连接信息是否正确（TypeORM DataSource）
  - 确保防火墙未阻止端口 3000

- 诊断提示缺少索引段落：
  - 使用 TipGeneratorService 重新生成 module.tip
  - 或手工补充 “文件列表 / 函数索引 / 关键词索引 / 快速检索映射” 段落

- 供应商不一致：
  - 运行迁移对齐枚举并清理旧记录
  - 确保代码仅支持：openai, anthropic, google, gemini, deepseek