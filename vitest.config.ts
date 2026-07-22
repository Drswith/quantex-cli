import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@quantex/core/internal',
        replacement: fileURLToPath(new URL('./packages/core/src/internal.ts', import.meta.url)),
      },
      {
        find: '@quantex/core',
        replacement: fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    globals: false,
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
})
