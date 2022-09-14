// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

module.exports = {
  verbose: true,
  testEnvironmentOptions: {
    url: 'http://localhost/',
  },
  rootDir: 'src',
  modulePaths: ['<rootDir>/src'],
  collectCoverage: false,
  testEnvironment: 'node',
  setupFiles: ['../scripts/jest.setup.js'],
  restoreMocks: true,
  transform: {
    '\\.[jt]sx?$': path.resolve(__dirname, './scripts/jestBabelTransform.js'),
  },
  extensionsToTreatAsEsm: ['.jsx'],
};
