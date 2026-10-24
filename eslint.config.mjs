import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    },
  },
  {
    files: [
      'apps/web/scripts/*.mjs',
      'scripts/validate_release*.mjs',
      'scripts/verify_frontend_capability_manifest.mjs',
      'scripts/verify_p1_demo.mjs',
      'scripts/seed_p1_demo.mjs',
      'scripts/analysis/*.mjs',
      'scripts/analysis/proofs/*.mjs',
      'scripts/e2e-cdp/*.mjs',
      'scripts/e2e-docker/*.mjs',
      'tests/e2e/runtime-local.spec.mjs',
    ],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.config.{js,mjs,ts}'],
    ...tseslint.configs.disableTypeChecked,
  },
);
