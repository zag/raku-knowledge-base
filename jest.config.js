module.exports = {
  moduleDirectories: ['node_modules'],
  modulePaths: ['<rootDir>'],
  snapshotSerializers: ['jest-serializer-html'],
  transform: {
    '\\.(t|j)sx?$': 'ts-jest',
  },
  prettierPath: null,
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/jest.tsconfig.json',
    },
  },
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\](?!entity-decode/).+\\.js$'],
}
