import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['node_modules/**', '.output/**', '.wxt/**', '.worktrees/**', '.local/**', '.superpowers/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.base],
    rules: { 'no-undef': 'off', 'no-unused-vars': 'off' },
  },
  { rules: { 'preserve-caught-error': 'off' }, languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.vitest, defineContentScript: 'readonly', defineBackground: 'readonly', browser: 'readonly', chrome: 'readonly' } } },
);
