import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cli.ts',
    'src/postinstall.ts',
  ],
  dts: true,
  format: 'esm',
  minify: true,
})
