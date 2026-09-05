import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

/**
 * Flat config for the whole workspace.
 *
 * Type-aware linting is on (`projectService`), which is the point: rules like
 * no-floating-promises and no-unsafe-assignment need real types to catch an
 * unawaited transaction or untyped request data reaching the payroll engine.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      'server/src/generated/**',
      'client/src/components/ui/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // Root config files are covered by the root tsconfig.json, so every
        // linted file belongs to a real project with strictNullChecks on.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { import: importPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'warn',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },

  /* Lane boundaries. Enforced by the linter so a cross-import fails CI
     rather than being caught in review. */
  {
    files: ['client/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/**', 'server/*'],
              message:
                'The client may not import from the server. Share types through @payz/shared.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['server/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/client/**', 'client/*'],
              message:
                'The server may not import from the client. Share types through @payz/shared.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/client/**', '**/server/**'],
              message:
                'shared is the contract both apps compile against; it may not depend on either.',
            },
          ],
        },
      ],
    },
  },

  /* Config files and tests run outside the strict app rules. */
  {
    // The seed prints the demo credentials, which is its whole purpose, and
    // the operator scripts are CLIs whose only output channel is the console.
    files: ['server/prisma/seed.ts', 'server/src/scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.config.{js,ts}', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },

  prettier,
);
