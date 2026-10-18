import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      RATE_LIMIT_DISABLED: '1',
      BCRYPT_ROUNDS: '6',
    },
  },
});
