/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^\\./db\\.js$': '<rootDir>/src/db.ts',
    '^\\./resources/group\\.resource\\.js$': '<rootDir>/src/resources/group.resource.ts',
    '^\\./tools/group\\.tools\\.js$': '<rootDir>/src/tools/group.tools.ts',
    '^\.\./db\\.js$': '<rootDir>/src/db.ts',
    '^\.\./\.\./src/index\\.js$': '<rootDir>/src/index.ts',
    '^\.\./\.\./src/tools/group\\.tools\\.js$': '<rootDir>/src/tools/group.tools.ts',
    '^\.\./\.\./src/db\\.js$': '<rootDir>/src/db.ts',
    // Any other src-relative .js import -> .ts (does not match node_modules)
    '^((?:\\.{1,2})/src/.*)\\.js$': '$1.ts'
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'nodenext',
          moduleResolution: 'nodenext',
          target: 'es2022',
        },
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: [
    '/node_modules/(?!(?:@axyor/family-serve-database)/)'
  ],
};// Deprecated: use jest.config.cjs
