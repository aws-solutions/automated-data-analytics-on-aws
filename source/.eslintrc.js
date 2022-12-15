/* eslint-disable */
const path = require('path');

const TEST_GLOBS = [
  '**/*mocks.*',
  '**/*.test.*',
  '**/*.spec.*',
  '**/testing/**',
  '**/test/**',
  '**/__snapshots__/**',
  '**/__fixtures__/**',
  '**/__tests__/**',
  '**/mock/**',
  '**/__mocks__/**',
  '**/*.stories.*',
  '**/cypress/**',
];

module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true,
  },
  // https://www.npmjs.com/package/eslint-plugin-disable
  processor: 'disable/disable',
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:sonarjs/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['disable', '@typescript-eslint', 'header', 'sort-imports-es6-autofix'],
  rules: {
    'header/header': ['error', path.join(__dirname, 'header.txt')],
    'sort-imports-es6-autofix/sort-imports-es6': [
      'error',
      {
        ignoreCase: false,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
      },
    ],

    'no-empty-function': 'warn',
    'no-undef': 'off',
    'no-func-assign': 'off',
    'max-len': [
      'error',
      {
        code: 120,
        ignoreComments: true,
        ignoreUrls: true,
        ignoreTrailingComments: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
        ignorePattern: 'NOSONAR',
      },
    ],

    '@typescript-eslint/no-empty-function': ['warn'],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_.*', varsIgnorePattern: '^_.*' }],
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-namespace': ['warn'],

    'sonarjs/cognitive-complexity': 'off',

    'padding-line-between-statements': [
      'warn',
      {
        blankLine: 'always',
        prev: ['export', 'class'],
        next: '*',
      },
    ],

    'sonarjs/no-small-switch': 'off',
  },
  overrides: [
    {
      files: TEST_GLOBS,
      settings: {
        'disable/plugins': ['sonarjs'],
      },
    },
    {
      files: TEST_GLOBS,
      rules: {
        'import/no-anonymous-default-export': 'off',
        'max-len': 'off',
      },
    },
  ],
};
