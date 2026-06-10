module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['services/**/*.js', 'utils/**/*.js', 'middleware/**/*.js', 'routes/**/*.js', 'models/**/*.js'],
  testMatch: ['**/tests/**/*.test.js', '**/tests/phase4.e2e.test.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true
};
