import { join } from 'node:path'
import { defineConfig } from 'tsdown'

const coreRoot = import.meta.dirname

export default defineConfig({
  clean: true,
  cwd: coreRoot,
  deps: {
    alwaysBundle: ['cross-spawn'],
    onlyBundle: false,
  },
  dts: true,
  entry: [join(coreRoot, 'src', 'index.ts')],
  fixedExtension: true,
  format: 'esm',
  minify: true,
  outDir: join(coreRoot, 'dist'),
  platform: 'node',
  target: 'node20',
  tsconfig: join(coreRoot, 'tsconfig.json'),
})
