import { Buffer } from 'node:buffer'
import { chmod, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

export async function upgradeStandaloneBinary(downloadUrl: string, executablePath: string): Promise<boolean> {
  if (process.platform === 'win32')
    return false

  const response = await fetch(downloadUrl)
  if (!response.ok)
    return false

  const tempDir = await mkdtemp(join(dirname(executablePath), '.quantex-upgrade-'))
  const tempPath = join(tempDir, basename(executablePath))

  try {
    const binary = Buffer.from(await response.arrayBuffer())
    const executableMode = await resolveExecutableMode(executablePath)

    await writeFile(tempPath, binary)
    await chmod(tempPath, executableMode)
    await rename(tempPath, executablePath)

    return true
  }
  catch {
    return false
  }
  finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function resolveExecutableMode(executablePath: string): Promise<number> {
  try {
    return (await stat(executablePath)).mode & 0o777
  }
  catch {
    return 0o755
  }
}
