// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  // === 添加这一行来忽略构建输出文件 ===
  {
    ignores: ["main.js", "dist/", ".git/", "node_modules/"]
  },

  // 使用 ESLint 推荐的 JS 规则
  eslint.configs.recommended, 
  
  // === 1. TypeScript 文件配置 (.ts, .tsx) ===
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
        globals: {
            browser: true,
        },
    },
    rules: {
      "no-undef": "off", 
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    }
  },

  // === 2. JavaScript/Node.js 文件配置 (.js, .mjs) ===
  // 确保你的 esbuild.config.mjs 和 version-bump.mjs 使用此配置
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        globals: {
            node: true, 
            browser: true, // 保留 browser 以防万一
            console: "readonly",
            module: "readonly",
            require: "readonly",
            process: "readonly",
        },
    },
    rules: {
        // 如果 main.js 被强制包含进来，但你又不想看到 require() 错误，可以禁用这个规则
        // "@typescript-eslint/no-require-imports": "off", 
    }
  }
];
