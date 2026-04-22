import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@tokenflow/shared': resolve(__dirname, 'packages/shared/src'),
      '@tokenflow/server': resolve(__dirname, 'packages/server/src'),
    },
  },
})
