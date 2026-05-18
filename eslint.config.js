import tseslint from 'typescript-eslint'
import globals from 'globals'
import pluginPromise from 'eslint-plugin-promise'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '_reference/**',
      'coverage/**',
      'packages/svgcanvas/dist/**',
      'tests/vendor/**',
      'src/editor/extensions/ext-shapes/shapelib/**'
    ]
  },
  // TypeChecked rules only for .ts/.tsx files (they must be in a tsconfig program)
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  // Non-type-checked rules for .js/.mjs/.cjs files
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [...tseslint.configs.recommended]
  },
  // Global settings applied to all files
  {
    linterOptions: {
      // Stale eslint-disable directives from standard's bundled plugins (e.g. promise/)
      // are present in source files. Demote to warn rather than error; backlog cleanup.
      reportUnusedDisableDirectives: 'warn'
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    // Register promise plugin so existing eslint-disable-next-line promise/* directives
    // in source files don't cause "rule not found" errors. Rules are all set to 'off'
    // (we don't enforce them); the registration just makes the disable directives valid.
    plugins: {
      promise: pluginPromise
    },
    rules: {
      'promise/catch-or-return': 'off',
      'promise/always-return': 'off'
    }
  },
  // Project-specific overrides for .ts files — strict errors; tighten over time
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  // Declaration files (.d.ts) — downgrade type-strictness for existing hand-authored decls
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',           // TODO: backlog — existing d.ts violations
      '@typescript-eslint/no-unsafe-function-type': 'warn',   // TODO: backlog — existing d.ts violations
      '@typescript-eslint/no-redundant-type-constituents': 'off' // type-checked rule off for d.ts
    }
  },
  // Project-specific overrides for .js files — warn for existing violations; backlog cleanup
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',           // TODO: backlog — existing JS violations
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // TODO: backlog — existing JS violations
      '@typescript-eslint/no-unused-expressions': 'warn',     // TODO: backlog — existing JS violations
      '@typescript-eslint/no-this-alias': 'warn',             // TODO: backlog — existing JS violations
      '@typescript-eslint/no-redundant-type-constituents': 'off'  // type-checked rule — cannot run on .js without projectService
    }
  },
  // Disable type-checked rules for test files and config files
  {
    files: ['tests/**/*.js', '*.config.{js,mjs,ts}'],
    extends: [tseslint.configs.disableTypeChecked]
  }
)
