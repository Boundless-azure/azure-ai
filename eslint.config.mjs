// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// 获取项目根目录，用于 tsconfigRootDir
const projectRoot = process.cwd();

const config = [
  // 1. 忽略文件配置
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'eslint.config.mjs',
    ],
  },

  // 2. 基础配置
  eslint.configs.recommended,

  // 3. TypeScript 推荐配置 (启用 Type Checking)
  ...tseslint.configs.recommendedTypeChecked,

  // 4. Prettier 推荐配置 (确保 Prettier 规则在最后，避免冲突)
  eslintPluginPrettierRecommended,

  // 5. 自定义配置和语言选项
  {
    // 应用于所有 TypeScript 文件
    files: ['**/*.ts', '**/*.tsx'],

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'module',

      // 配置解析器选项
      parserOptions: {
        tsconfigRootDir: projectRoot,
        project: true, // 启用类型检查 (读取 tsconfig.json)
      },
    },

    // 自定义规则
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-unused-vars': 'off',
    },
  },

  // 6. 为测试文件关闭对 Jest 匹配器的误报
  {
    files: ['**/*.spec.ts', '**/*.test.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
];

// 过滤掉任何意外混入的旧格式配置块（含 extends 字段）
// 这是为了防止 node_modules 里依赖包的 eslintConfig 被 VSCode ESLint 插件意外加载
export default config.filter(item => !('extends' in item));