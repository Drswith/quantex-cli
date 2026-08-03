import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { getReleaseArchiveName, REQUIRED_RELEASE_BINARY_NAMES } from '../src/release-artifacts'

const binDir = 'dist/bin'
const availableFiles = new Set(await readdir(binDir))

for (const binaryName of REQUIRED_RELEASE_BINARY_NAMES) {
  if (!availableFiles.has(binaryName)) throw new Error(`Missing release binary: ${binaryName}.`)

  const archiveName = getReleaseArchiveName(binaryName)
  const archivePath = join(binDir, archiveName)
  await rm(archivePath, { force: true })
  await runChecked(['tar', '--format=ustar', '-czf', archivePath, '-C', binDir, binaryName])
}

async function runChecked(command: string[]): Promise<void> {
  const child = Bun.spawn(command, {
    env: { ...process.env, COPYFILE_DISABLE: '1' },
    stderr: 'inherit',
    stdout: 'inherit',
  })
  const exitCode = await child.exited
  if (exitCode !== 0) throw new Error(`Command failed with exit code ${exitCode}: ${command.join(' ')}`)
}
