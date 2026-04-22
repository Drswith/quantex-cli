import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig } from 'bumpp'

export default defineConfig({
  execute: async (operation) => {
    const result = spawnSync('bun', ['run', 'scripts/write-build-metadata.ts'], {
      cwd: operation.options.cwd,
      stdio: 'inherit',
    })

    if (result.status !== 0)
      throw new Error(`Failed to update build metadata before release commit (exit code: ${result.status ?? 'unknown'})`)

    const buildMetaFile = resolve(operation.options.cwd, 'src/generated/build-meta.ts')

    if (!operation.state.updatedFiles.includes(buildMetaFile)) {
      operation.update({
        updatedFiles: operation.state.updatedFiles.concat(buildMetaFile),
      })
    }
  },
})
