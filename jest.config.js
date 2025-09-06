/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': [ 'ts-jest', { tsconfig: { target: 'es2023', module: 'Node16' } } ]
  },
  transformIgnorePatterns: ['/node_modules/(?!(?:@axyor/family-serve-database)/)']
};
