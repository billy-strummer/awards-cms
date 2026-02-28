/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  forceExit: true,
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  transform: {
    '^.+\\.js$': '<rootDir>/jest-esm-transform.js'
  },
  transformIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: [
    '*.js',
    'api/*.js',
    '!build.js',
    '!check-schema.js',
    '!diagnose.js',
    '!bulk-csv-importer.js',
    '!jest.config.js',
    '!jest-esm-transform.js',
    '!main.js',
    '!dist/**',
    '!scripts/**',
    '!node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 40,
      lines: 40,
      statements: 40
    }
  }
};
