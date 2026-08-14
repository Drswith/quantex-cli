import { chmod, copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

const sourceDir = 'dist/bin'
const targetDir = 'apps/desktop/src-tauri/resources/bin'
const targets = ['quantex-darwin-arm64', 'quantex-darwin-x64'] as const

const build = Bun.spawn(['bun', 'run', 'build:bin', 'darwin'], {
  cwd: process.cwd(),
  stderr: 'inherit',
  stdout: 'inherit',
})
if ((await build.exited) !== 0) process.exit(1)

await mkdir(targetDir, { recursive: true })
for (const target of targets) {
  const source = join(sourceDir, target)
  const destination = join(targetDir, target)
  await copyFile(source, destination)
  await chmod(destination, 0o755)
}
