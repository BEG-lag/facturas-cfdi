import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'test-results/', 'playwright-report/', 'tests/.generated/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-irregular-whitespace': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message: 'La app no hace peticiones de red: no uses fetch.',
        },
        {
          selector: "NewExpression[callee.name='XMLHttpRequest']",
          message: 'La app no hace peticiones de red: no uses XMLHttpRequest.',
        },
        {
          selector: "NewExpression[callee.name='WebSocket']",
          message: 'La app no hace peticiones de red: no uses WebSocket.',
        },
      ],
    },
  },
  {
    files: ['plugins/**', 'scripts/**', 'tests/**', '*.config.*'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
