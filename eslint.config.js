import js from '@eslint/js';
import globals from 'globals';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginImport from 'eslint-plugin-import';
import pluginJsxA11y from 'eslint-plugin-jsx-a11y';

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  // ── Base JS rules ─────────────────────────────────────────────
  js.configs.recommended,

  // ── Global environments ────────────────────────────────────────
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
        process: 'readonly', // CRA injects process.env
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },

  // ── React + Hooks + A11y + Import ─────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
      'jsx-a11y': pluginJsxA11y,
      import: pluginImport,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // ── React ──────────────────────────────────────────────────
      ...pluginReact.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',      // Not needed in React 17+
      'react/prop-types': 'off',              // No PropTypes enforcement (JS project)
      'react/display-name': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/jsx-no-target-blank': 'error',   // Security: always use rel="noopener"
      'react/jsx-key': 'error',               // Lists must have keys

      // ── React Hooks ────────────────────────────────────────────
      ...pluginReactHooks.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // ── Accessibility ──────────────────────────────────────────
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-is-valid': 'warn',

      // ── Import order ───────────────────────────────────────────
      'import/no-duplicates': 'error',
      'import/no-unused-modules': 'off',

      // ── General quality ────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-debugger': 'error',
      'no-alert': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
    },
  },

  // ── Test files — relax rules ───────────────────────────────────
  {
    files: ['src/**/*.test.{js,jsx}', 'src/setupTests.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // ── Config files — allow CommonJS ─────────────────────────────
  {
    files: ['*.config.js', 'craco.config.js', 'postcss.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },

  // ── Ignores ────────────────────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      'build/**',
      'public/**',
      'supabase/**',
      'coverage/**',
    ],
  },
];
