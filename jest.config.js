const path = require('path')

const transformIgnores = [
  'entity-decode',
  '.*remark-parse',
  '.*mdast.*',
  '.*micromark.*',
  '.*decode-named-character-reference',
  '.*character-entities',
  '.*unist',
  '.*unified',
  '.*bail',
  '.*is-plain-obj',
  '.*trough',
  '.*vfile',
  '.*remark-gfm',
  '.*remark-math',
  '.*mdast-util-math',
  '.*ccount',
  '.*escape-string-regexp',
  '.*markdown-table',
  '.*longest-streak',
  'remark',
  'zwitch',
].join('|')

module.exports = {
  // the corpus under work_mods carries other projects' .snap files; without a root
  // jest walks into them, calls 66 of them obsolete and exits non-zero on a green run
  roots: ['<rootDir>/t'],

  moduleDirectories: ['node_modules'],
  modulePaths: ['<rootDir>'],
  snapshotSerializers: ['jest-serializer-html'],
  testMatch: ['<rootDir>/t/**/*.spec.ts'],
  transform: {
    '\\.(t|j)sx?$': 'ts-jest',
  },
  prettierPath: null,
  moduleNameMapper: {
    '\\.css$': path.resolve(__dirname, 'jest-css-stub.js'),
    '^mermaid$': path.resolve(__dirname, 'jest-mermaid-stub.js'),
    '^@podlite/publisher/lib/(.*)$': path.resolve(__dirname, '../podlite/packages/podlite-publisher/lib/$1'),
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/jest.tsconfig.json',
    },
  },
  transformIgnorePatterns: [`[/\\\\]node_modules[/\\\\](?!${transformIgnores}).+\\.js$`],
}
