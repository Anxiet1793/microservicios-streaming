import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
export default defineConfig(
  { ignores: ['.next/**', 'node_modules/**', 'dist/**', 'coverage/**', 'next-env.d.ts'] },
  { files: ['**/*.ts'], extends: [js.configs.recommended, tseslint.configs.recommended], rules: { '@typescript-eslint/consistent-type-imports': 'error' } },
);
