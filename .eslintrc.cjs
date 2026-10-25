/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
  },
  overrides: [
    {
      // NestJS emitDecoratorMetadata requires runtime class value imports for constructor DI
      files: ['apps/api-core/**/*.ts'],
      rules: {
        '@typescript-eslint/consistent-type-imports': 'off',
      },
    },
    {
      // Enforce intelligence-core isolation: no imports from platform-modules
      files: ['apps/api-core/src/intelligence-core/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/platform-modules/**'],
                message: 'SparkTrack IP Violation: intelligence-core must NEVER import from platform-modules. Use domain events (BullMQ) for cross-boundary communication.',
              },
            ],
          },
        ],
      },
    },
  ],
};
