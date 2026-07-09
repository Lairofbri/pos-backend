const js = require('@eslint/js');
const globals = require('globals');
const tseslint = require('typescript-eslint');

module.exports = [
  { ignores: ['dist'] },
  {
    files: ['**/*.js', '**/*.cjs'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  ...tseslint.config(
    {
      files: ['**/*.ts'],
      extends: [
        ...tseslint.configs.recommended,
      ],
      languageOptions: {
        sourceType: 'module',
        parserOptions: {
          projectService: true,
          tsconfigRootDir: __dirname,
        },
        globals: { ...globals.node },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'no-console': 'off',
      },
    },
  ),
];
