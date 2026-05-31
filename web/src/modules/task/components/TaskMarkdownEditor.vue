<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-3">
      <label class="block text-sm font-medium text-gray-700">{{ label }}</label>
      <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
        Markdown
      </span>
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div class="border-b border-gray-100 bg-gray-50 px-3 py-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            class="task-toolbar-button"
            title="一级标题"
            @click="insertHeading(1)"
          >
            <i class="fa-solid fa-heading"></i>
            H1
          </button>
          <button
            type="button"
            class="task-toolbar-button"
            title="二级标题"
            @click="insertHeading(2)"
          >
            <i class="fa-solid fa-heading"></i>
            H2
          </button>
          <button
            type="button"
            class="task-toolbar-button"
            title="加粗"
            @click="wrapSelection('**', '**', '加粗内容')"
          >
            <i class="fa-solid fa-bold"></i>
          </button>
          <button
            type="button"
            class="task-toolbar-button"
            title="斜体"
            @click="wrapSelection('*', '*', '斜体内容')"
          >
            <i class="fa-solid fa-italic"></i>
          </button>
          <button
            type="button"
            class="task-toolbar-button"
            title="无序列表"
            @click="prefixLines('- ', '列表项')"
          >
            <i class="fa-solid fa-list-ul"></i>
          </button>
          <button
            type="button"
            class="task-toolbar-button"
            title="任务列表"
            @click="prefixLines('- [ ] ', '待办事项')"
          >
            <i class="fa-solid fa-list-check"></i>
          </button>
          <button
            type="button"
            class="task-toolbar-button"
            title="引用"
            @click="prefixLines('> ', '引用内容')"
          >
            <i class="fa-solid fa-quote-left"></i>
          </button>
          <button
            type="button"
            class="task-toolbar-button"
            title="代码块"
            @click="insertCodeBlock()"
          >
            <i class="fa-solid fa-code"></i>
          </button>
          <button
            type="button"
            class="task-toolbar-button"
            title="链接"
            @click="insertLink()"
          >
            <i class="fa-solid fa-link"></i>
          </button>
        </div>
      </div>

      <textarea
        ref="editorRef"
        :value="modelValue"
        :placeholder="placeholder"
        class="min-h-[260px] w-full resize-y border-0 bg-white px-4 py-3 font-mono text-sm leading-6 text-gray-800 focus:outline-none"
        @input="updateValue"
      ></textarea>
    </div>

    <p v-if="hint" class="text-xs text-gray-400">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * @title TaskMarkdownEditor
 * @description 任务模块里的 Markdown 编辑器，提供工具栏快捷插入与单栏编辑。
 * @keywords-cn 任务里程碑, Markdown编辑器, 工具栏插入
 * @keywords-en task-milestone, markdown-editor, toolbar-insert
 */
import { nextTick, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label?: string;
    placeholder?: string;
    hint?: string;
  }>(),
  {
    label: 'Markdown 内容',
    placeholder: '请输入 Markdown 内容',
    hint: '',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const editorRef = ref<HTMLTextAreaElement | null>(null);

/**
 * @title 更新编辑值
 * @description 将 textarea 的内容同步回父组件。
 * @keyword-en update-task-markdown-value
 */
function updateValue(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
}

/**
 * @title 获取编辑器选区
 * @description 返回当前 textarea、选区范围和选中文本。
 * @keyword-cn 编辑器选区, 文本插入, 光标范围
 * @keyword-en get-editor-selection, text-insert, cursor-range
 */
function getEditorSelection(): {
  textarea: HTMLTextAreaElement;
  value: string;
  start: number;
  end: number;
  selectedText: string;
} | null {
  const textarea = editorRef.value;
  if (!textarea) {
    return null;
  }
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const value = props.modelValue;
  return {
    textarea,
    value,
    start,
    end,
    selectedText: value.slice(start, end),
  };
}

/**
 * @title 应用编辑器变更
 * @description 更新父组件值，并在下一帧恢复焦点与选区。
 * @keyword-cn 应用编辑器变更, 恢复焦点, 恢复选区
 * @keyword-en apply-editor-change, restore-focus, restore-selection
 */
function applyEditorChange(
  nextValue: string,
  selectionStart: number,
  selectionEnd: number,
): void {
  emit('update:modelValue', nextValue);
  void nextTick(() => {
    if (!editorRef.value) return;
    editorRef.value.focus();
    editorRef.value.setSelectionRange(selectionStart, selectionEnd);
  });
}

/**
 * @title 包裹选中文本
 * @description 给当前选区套上 Markdown 包裹语法，例如粗体或斜体。
 * @keyword-cn 包裹选中内容, 粗体, 斜体
 * @keyword-en wrap-selection, bold, italic
 */
function wrapSelection(
  prefix: string,
  suffix: string,
  fallbackText: string,
): void {
  const selection = getEditorSelection();
  if (!selection) return;

  const content = selection.selectedText || fallbackText;
  const inserted = `${prefix}${content}${suffix}`;
  const nextValue =
    selection.value.slice(0, selection.start) +
    inserted +
    selection.value.slice(selection.end);

  applyEditorChange(
    nextValue,
    selection.start + prefix.length,
    selection.start + prefix.length + content.length,
  );
}

/**
 * @title 插入标题
 * @description 为当前行或选区插入 Markdown 标题语法。
 * @keyword-cn 插入标题, Markdown标题, 标题层级
 * @keyword-en insert-heading, markdown-heading, heading-level
 */
function insertHeading(level: number): void {
  const prefix = `${'#'.repeat(level)} `;
  prefixLines(prefix, level === 1 ? '一级标题' : '二级标题');
}

/**
 * @title 给选区逐行加前缀
 * @description 用于列表、引用和任务列表等块级 Markdown 语法插入。
 * @keyword-cn 列表前缀, 引用前缀, Markdown块语法
 * @keyword-en prefix-lines, blockquote-prefix, markdown-block-syntax
 */
function prefixLines(prefix: string, fallbackText: string): void {
  const selection = getEditorSelection();
  if (!selection) return;

  const content = selection.selectedText || fallbackText;
  const lines = content.split('\n');
  const prefixed = lines.map((line) => `${prefix}${line || fallbackText}`).join('\n');
  const nextValue =
    selection.value.slice(0, selection.start) +
    prefixed +
    selection.value.slice(selection.end);

  applyEditorChange(
    nextValue,
    selection.start,
    selection.start + prefixed.length,
  );
}

/**
 * @title 插入代码块
 * @description 在当前位置插入 Markdown 代码块模板。
 * @keyword-cn 代码块模板, Markdown代码块, 多行插入
 * @keyword-en insert-code-block, markdown-code-fence, multiline-insert
 */
function insertCodeBlock(): void {
  const selection = getEditorSelection();
  if (!selection) return;

  const content = selection.selectedText || 'code';
  const inserted = `\n\`\`\`\n${content}\n\`\`\`\n`;
  const nextValue =
    selection.value.slice(0, selection.start) +
    inserted +
    selection.value.slice(selection.end);

  const codeStart = selection.start + 5;
  applyEditorChange(nextValue, codeStart, codeStart + content.length);
}

/**
 * @title 插入链接
 * @description 在当前位置插入 Markdown 链接模板。
 * @keyword-cn 插入链接, Markdown链接, 链接模板
 * @keyword-en insert-link, markdown-link, link-template
 */
function insertLink(): void {
  const selection = getEditorSelection();
  if (!selection) return;

  const label = selection.selectedText || '链接文字';
  const inserted = `[${label}](https://example.com)`;
  const nextValue =
    selection.value.slice(0, selection.start) +
    inserted +
    selection.value.slice(selection.end);

  const urlStart = selection.start + label.length + 3;
  applyEditorChange(nextValue, urlStart, urlStart + 'https://example.com'.length);
}
</script>

<style scoped>
.task-toolbar-button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 0.4rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #4b5563;
  transition: background-color 0.15s ease, border-color 0.15s ease,
    color 0.15s ease;
}

.task-toolbar-button:hover {
  border-color: #d1d5db;
  background: #f9fafb;
  color: #111827;
}
</style>
