import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', '.__mf__temp', 'node_modules', 'e2e/.stack', 'e2e/test-results', 'e2e/playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Acessibilidade é regra do projeto: elementos reais, labels, alt, papéis ARIA válidos.
  jsxA11y.flatConfigs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js', 'e2e/**/*.{ts,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
