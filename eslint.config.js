import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default defineConfig([
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '_reference/**',
      'coverage/**',
      'packages/svgcanvas/dist/**',
      'tests/vendor/**',
      'src/editor/extensions/ext-shapes/shapelib/**',
      // Harness-managed worktrees (Claude Code Agent isolation): each in-flight worktree
      // sits at .claude/worktrees/agent-<id>/ and contains a full repo checkout. Without
      // this ignore, ESLint walks the worktree's `dist/`, `_reference/`, and `node_modules/`
      // copies in addition to the main repo's, producing thousands of spurious findings
      // every time a worktree is still present at lint time.
      '.claude/**'
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
  // Linter options applied globally
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'warn'
    }
  },
  // Globals applied to all files
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
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
  // packages/svgcanvas/svgcanvas.d.ts — the existing hand-written shim slated for
  // removal in Task 10. Downgrade its strictness so it doesn't block lint while it
  // still lives on the branch. New hand-authored .d.ts files (e.g. the Task 3
  // svgcanvas.augment.d.ts) inherit strict rules from the .ts block above.
  {
    files: ['packages/svgcanvas/svgcanvas.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'off'
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
])
