// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import path from 'path'; // 导入 path 模块

// 获取项目根目录，用于 tsconfigRootDir
const projectRoot = process.cwd();

export default [
  // 1. 忽略文件配置
  {
    ignores: ['eslint.config.mjs', 'node_modules', 'dist'], // 增加忽略 node_modules 和 dist
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
      // 保持 sourceType: 'commonjs' 或改为 'module' 取决于您的项目，
      // 对于现代 Node.js 模块项目，可以改为 'module'
      sourceType: 'module', 
      
      // 配置解析器选项
      parserOptions: {
        // 重要：使用 path.resolve() 替代 import.meta.dirname
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
      
      // 允许以下划线开头的未使用变量/参数/捕获错误，无需报错
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // 您可能需要为 tsconfig.json 启用 `allowJs` 来检查 JS 文件，否则可能不需要以下规则
      'no-unused-vars': 'off', // 禁用 ESLint 自身的 no-unused-vars
    },
  },
  
  // 6. 为测试文件关闭对 Jest 匹配器的误报
  {
    files: ['**/*.spec.ts', '**/*.test.ts', 'test/**/*.ts'],
    rules: {
      // 在测试文件中，对外部引入对象的属性访问设置为 off 通常是必要的
      '@typescript-eslint/no-unsafe-member-access': 'off', 
    },
  },
];