# Azure AI (XiaoLan)

Languages: [English](/docs/readme/README.en.md) · [中文](/docs/readme/README.zh-CN.md)

## 🚀 Vision & Goals

**"XiaoLan"** is a next-generation AI interaction portal designed to replace traditional click-based web operations with natural language interactions. It enables users to manage data, control interfaces, and execute business logic directly through conversation.

Core Features:
*   **Self-Growth**: AI autonomously generates code plugins that integrate back into the platform, creating a continuous improvement loop.
*   **Controlled Generation**: Uses "Generation Constraints + Transaction Bus (HookBus)" to ensure AI-generated code is safe, low-dependency, and auditable.
*   **AI Execution Standards**: Standardized frontend component control protocols allowing AI to precisely manipulate the UI.

## 🛠️ Technical Architecture

### 1. Frontend (Web Client)
*   **Tech Stack**: Vue 3 (Composition API) + TypeScript + Tailwind CSS + Pinia.
*   **Modular Design**:
    *   `Agent` Module: Core chat interaction.
    *   `IM` Module: Decoupled UI and communication via `useImChatAdapter`.
*   **Interaction Experience**:
    *   **Multi-modal Input**: Voice recording (Real-time waveform/Minimalist UI), Text, Emoji, Image preview, File handling.
    *   **Smart Contacts**: Auto-grouping (AI Agents/Groups/Contacts) with Pinyin/Initial sorting.
    *   **Streaming Response**: Full SSE support with real-time Markdown rendering.

### 2. Backend (Server)
*   **Service Orchestration**: Modular services (NestJS based).
*   **Function Call**: Native LLM function integration with dynamic tool injection.
    *   `PluginOrchestratorService`: Plugin orchestration.
    *   `MysqlReadonlyService`: Secure read-only database queries.
*   **HookBus**: The core bus connecting frontend actions and backend logic, ensuring event consistency and order.

## 📅 Roadmap

### ✅ Completed (Phase 1: Foundation & Interaction)
- [x] **Frontend Framework**: Modular Vue 3 + Tailwind setup.
- [x] **Chat Interaction**: Streaming message rendering, Markdown support.
- [x] **Voice Input**: Minimalist recording UI with real-time volume waveform.
- [x] **Multi-modal Support**: Emoji picker, Mobile/PC image preview, File system integration.
- [x] **Smart Address Book**: Grouping strategy (AI Agents > Groups > Contacts) and Pinyin sorting.
- [x] **Internationalization**: i18n support.

### 🚧 In Progress (Phase 2: Core AI Capabilities)
- [ ] **DB Write Operations**: Secure SQL execution with whitelisting and auditing.
- [ ] **Granular Permissions**: Row/Column level access control.
- [ ] **HookBus Integration**: Unified bus for frontend-backend actions.
- [ ] **Self-Growth Loop**: "Plan -> Generate -> Test -> Deploy" workflow.

### 🔮 Future (Phase 3: Deep Integration)
- [ ] **Auto-CRUD**: Generate management pages from DB schema.
- [ ] **Multi-Agent Collaboration**: Complex task orchestration.
- [ ] **Business Plugins**: Customer analytics, automated reporting, etc.

## 🚦 Quick Start

1. **Install Dependencies**
```bash
npm install
```

2. **Start Development Server**
```bash
npm run dev
```

3. **Build for Production**
```bash
npm run build
```
