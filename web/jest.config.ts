import type { Config } from 'jest';
const config: Config = { preset: 'ts-jest', testEnvironment: 'node', roots: ['<rootDir>/__tests__'], moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' }, verbose: true };
export default config;
