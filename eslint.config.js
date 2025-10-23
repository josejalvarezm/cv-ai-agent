import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        Promise: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        URL: 'readonly',
        Float32Array: 'readonly',
        Uint8Array: 'readonly',
        ArrayBuffer: 'readonly',
        Math: 'readonly',
        isNaN: 'readonly',
        caches: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
      'no-undef': 'off', // TypeScript handles this
    },
  },
];
