# AI Agent Workspace UI Documentation

This document describes the User Interface (UI) architecture, design system, and component structure for the AI Agent Workspace. It is intended to serve as a reference for future AI agents or developers extending the frontend.

## 1. Technical Stack

The UI is built as a lightweight, static implementation without a build step, designed for easy portability and rapid prototyping.

*   **Framework**: Vue 3 (via CDN, Composition API)
*   **Styling**: Tailwind CSS (via CDN script)
*   **Icons**: FontAwesome 6.4.0 (via CDN)
*   **Animations**: Animate.css & Custom CSS
*   **Syntax Highlighting**: Highlight.js (Github Dark theme)
*   **Markdown Rendering**: Marked.js

## 2. Directory Structure

```
e:\project\azure-ai\static\
├── css\
│   └── main.css          # Shared global styles (Scrollbars, Animations)
├── js\                   # (Reserved for shared logic)
├── index.html            # Main Entry: Chat Interface & Sidebar
├── role.html             # Role Management Module
├── user.html             # User Management Module
├── permission.html       # Permission/Access Control Module
├── memory.html           # Agent Memory Management
├── schema.html           # Database Schema Visualization
├── todo.html             # Task/Todo Management (Kanban)
├── workflow.html         # Workflow Builder
└── UI_DOCUMENTATION.md   # This file
```

## 3. Layout Architecture

The application uses a persistent **Split-Pane Layout**:

### 3.1. Primary Sidebar (Leftmost)
*   **Width**: Fixed at `72px`.
*   **Purpose**: Global navigation between modules.
*   **State**: Always visible.
*   **Components**:
    *   Top: History Toggle, New Chat.
    *   Middle: Module Icons (Chat, Role, User, Permission, Memory, Schema, Todo, Workflow).
    *   Bottom: Settings, User Profile.
*   **Interaction**: Clicking an icon navigates to the respective `.html` file.

### 3.2. Secondary Sidebar / Sub-menu (Middle-Left)
*   **Width**: Variable.
    *   *Index Page*: Expandable (`0px` to `228px`). Used for Chat History.
    *   *Module Pages*: Fixed (`228px`). Used for Module-specific navigation (Directory).
*   **Context**: Changes based on the selected module.
    *   *Example (Role)*: "All Roles", "Create Role", "Assignments".
    *   *Example (Todo)*: "Kanban Board", "List View".

### 3.3. Main Content Area (Right)
*   **Width**: `flex-1` (Fills remaining space).
*   **Purpose**: The primary workspace for the selected module.
*   **Structure**:
    *   **Header**: Module Title, Actions (e.g., "Create New").
    *   **Body**: Scrollable content area.

## 4. Design System

### 4.1. Color Palette
The design relies on the standard Tailwind CSS palette with custom extensions:

*   **Backgrounds**:
    *   App Background: `bg-white`
    *   Sidebar: `bg-gray-50`
    *   Hover States: `hover:bg-gray-200`
    *   Active Item: `bg-white` + `shadow-sm` (in Sub-menu) or `bg-gray-200` (in Primary Sidebar).
*   **Text**:
    *   Primary: `text-gray-900`
    *   Secondary/Icons: `text-gray-600`
    *   Muted/Labels: `text-gray-400` or `text-gray-500`
*   **Accents**:
    *   Primary Action: Black (`#000000`) - defined in `tailwind.config`.

### 4.2. Typography
*   **Font Family**: Default Sans-serif (`font-sans`).
*   **Sizes**:
    *   Headers: `text-lg font-semibold`
    *   Body: `text-sm`
    *   Labels: `text-xs font-semibold uppercase tracking-wider`

### 4.3. Shared CSS (`css/main.css`)
*   **Scrollbars**: Custom thin scrollbars (`8px` width) with rounded thumbs.
*   **Animations**:
    *   `.thinking-dot`: Bouncing animation for AI loading states.

## 5. Component Patterns

### 5.1. Navigation Buttons (Primary Sidebar)
```html
<button onclick="window.location.href='target.html'" class="w-10 h-10 rounded-lg hover:bg-gray-200 flex items-center justify-center transition-colors group relative">
  <i class="fa-solid fa-icon-name text-gray-600"></i>
  <!-- Tooltip (Optional) -->
</button>
```

### 5.2. Sub-Menu Items (Module Sidebar)
Managed via Vue `currentView` state:
```html
<button @click="currentView = 'viewName'" :class="['w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2', currentView === 'viewName' ? 'bg-white shadow-sm text-black' : 'text-gray-600 hover:bg-gray-200']">
  <i class="fa-solid fa-icon-name text-xs w-4"></i> Label
</button>
```

### 5.3. Content Views
Uses `v-if` to switch between views based on `currentView`:
```html
<div v-if="currentView === 'list'" class="space-y-4">
  <!-- List Content -->
</div>
<div v-if="currentView === 'create'">
  <!-- Form Content -->
</div>
```

## 6. Extension Guide

To add a new module:

1.  **Duplicate** an existing module file (e.g., `role.html`).
2.  **Rename** to `new-module.html`.
3.  **Update Navigation**:
    *   Add a button in the Primary Sidebar of **ALL** HTML files (including `index.html`) pointing to `new-module.html`.
    *   Ensure the new module's button is highlighted (active state) in `new-module.html`.
4.  **Define Sub-menu**: Update the "Directory" section in the Secondary Sidebar.
5.  **Implement Views**: Create Vue state (`currentView`) and corresponding content sections.
