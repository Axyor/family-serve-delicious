/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^\\./db\\.js$': '<rootDir>/src/db.ts',
    '^\\./resources/group\\.resource\\.js$': '<rootDir>/src/resources/group.resource.ts',
    '^\\./tools/group\\.tools\\.js$': '<rootDir>/src/tools/group.tools.ts',
    '^\.\./db\\.js$': '<rootDir>/src/db.ts',
    // Any other src-relative .js import -> .ts (does not match node_modules)
    '^((?:\\.{1,2})/src/.*)\\.js$': '$1.ts'
  },
  transform: {
    '^.+\\.(ts|tsx)$': [ 'ts-jest', { tsconfig: { target: 'es2023', module: 'Node16' } } ]
  },
  transformIgnorePatterns: ['/node_modules/(?!(?:@axyor/family-serve-database)/)']
};
