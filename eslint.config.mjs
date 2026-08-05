import globals from 'globals';

/**
 * Flat config, required since ESLint 9 - .eslintrc.json is no longer read.
 * Mirrors the previous .eslintrc.json: browser globals, ES2020, same rules.
 */
export default [
  {
    files: ['*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      // script.js is loaded with a plain <script> tag, not as a module.
      sourceType: 'script',
      globals: globals.browser,
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      semi: 'warn',
    },
  },
  {
    // Build tooling: Node ESM, not browser scripts. Previously unlinted.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      semi: 'warn',
    },
  },
];
