-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS azure_ai_dev;

-- 使用数据库
USE azure_ai_dev;

-- 为确保与实体严格对齐，先删除旧表（无数据保留）
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS prompt_templates;
DROP TABLE IF EXISTS ai_models;

-- 创建 AI 模型表（与 AIModelEntity 对齐，加入统一基础字段）
CREATE TABLE IF NOT EXISTS ai_models (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    displayName VARCHAR(200),
    provider ENUM('openai','azure-openai','anthropic','google') NOT NULL,
    type ENUM('chat','completion','embedding') NOT NULL,
    status ENUM('active','inactive','deprecated','maintenance') NOT NULL DEFAULT 'active',
    apiKey VARCHAR(500) NOT NULL,
    baseURL VARCHAR(500),
    azureConfig JSON,
    defaultParams JSON,
    description TEXT,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_user CHAR(36),
    update_user CHAR(36),
    channel_id VARCHAR(100),
    is_delete TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_ai_models_name (name),
    INDEX idx_ai_models_provider_type (provider, type),
    INDEX idx_ai_models_status_enabled (status, enabled),
    INDEX idx_ai_models_is_delete (is_delete),
    INDEX idx_ai_models_channel_id (channel_id)
);

-- 创建 Prompt 模板表（与 PromptTemplateEntity 对齐，加入统一基础字段）
CREATE TABLE IF NOT EXISTS prompt_templates (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    template TEXT NOT NULL,
    variables JSON NOT NULL,
    description TEXT,
    category VARCHAR(50),
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_user CHAR(36),
    update_user CHAR(36),
    channel_id VARCHAR(100),
    is_delete TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_prompt_templates_name (name),
    INDEX idx_prompt_templates_category_enabled (category, enabled),
    INDEX idx_prompt_templates_is_delete (is_delete),
    INDEX idx_prompt_templates_channel_id (channel_id)
);

-- 创建聊天会话表（与 ChatSessionEntity 对齐，加入统一基础字段；主键改为 id，session_id 唯一）
CREATE TABLE IF NOT EXISTS chat_sessions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    messages JSON NOT NULL,
    system_prompt TEXT,
    metadata JSON,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_user CHAR(36),
    update_user CHAR(36),
    channel_id VARCHAR(100),
    is_delete TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY uq_chat_sessions_session_id (session_id),
    INDEX idx_chat_sessions_user_id (user_id),
    INDEX idx_chat_sessions_is_delete (is_delete),
    INDEX idx_chat_sessions_channel_id (channel_id)
);

-- 插入默认的 AI 模型配置（使用 UUID() 生成主键，provider/type 值与枚举一致）
INSERT INTO ai_models (id, name, displayName, provider, type, status, apiKey, description, enabled)
VALUES
(UUID(), 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 'openai', 'chat', 'active', 'CHANGE_ME', 'OpenAI GPT-3.5 Turbo 模型', 1),
(UUID(), 'gpt-4', 'GPT-4', 'openai', 'chat', 'active', 'CHANGE_ME', 'OpenAI GPT-4 模型', 1),
(UUID(), 'gpt-35-turbo', 'Azure GPT-3.5 Turbo', 'azure-openai', 'chat', 'active', 'CHANGE_ME', 'Azure OpenAI GPT-3.5 Turbo 模型', 1)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- 插入默认的提示模板（示例，可按需扩展）
INSERT INTO prompt_templates (id, name, template, variables, category, description, enabled)
VALUES
(UUID(), 'default_assistant', 'You are a helpful AI assistant.', JSON_ARRAY(), 'system', '默认助手提示词', 1),
(UUID(), 'code_helper', 'You are an experienced programming assistant. Help users write clean, efficient code.', JSON_ARRAY(), 'system', '编程助手提示词', 1),
(UUID(), 'translator', 'You are a professional translator. Translate text accurately while maintaining context and tone.', JSON_ARRAY(), 'system', '翻译助手提示词', 1)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;