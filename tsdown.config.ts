import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  alias: {
    '@quantex/core': './packages/core/src/index.ts',
    '@quantex/core/internal': './packages/core/src/internal.ts',
  },
  clean: true,
  deps: {
    alwaysBundle: ['@quantex/core', '@quantex/core/internal'],
  },
  dts: true,
  format: 'esm',
  minify: true,
  outDir: 'dist',
  platform: 'node',
  target: 'node20',
})
