import type { SelfUpdateResult, SelfUpgradeErrorKind } from './types'
import { Buffer } from 'node:buffer'
import { chmod, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

type BinaryUpgradeResult = Omit<SelfUpdateResult, 'installSource'>

export async function upgradeStandaloneBinary(downloadUrl: string, executablePath: string): Promise<BinaryUpgradeResult> {
  let response: Response

  try {
    response = await fetch(downloadUrl)
  }
  catch (error) {
    return createBinaryFailure('network', `Failed to download ${downloadUrl}.`, error)
  }

  if (!response.ok) {
    return createBinaryFailure('network', `Failed to download ${downloadUrl}: HTTP ${response.status}.`)
  }

  const tempDir = await mkdtemp(join(dirname(executablePath), '.quantex-upgrade-'))
  const tempPath = join(tempDir, basename(executablePath))

  try {
    const binary = Buffer.from(await response.arrayBuffer())
    const executableMode = await resolveExecutableMode(executablePath)

    await writeFile(tempPath, binary)

    if (process.platform === 'win32')
      return scheduleWindowsBinaryReplacement(tempPath, executablePath, tempDir)

    await chmod(tempPath, executableMode)
    await rename(tempPath, executablePath)

    return {
      success: true,
    }
  }
  catch (error) {
    return createBinaryFailure(resolveBinaryErrorKind(error), 'Failed to replace the current Quantex binary.', error)
  }
  finally {
    if (process.platform !== 'win32')
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

function scheduleWindowsBinaryReplacement(tempPath: string, executablePath: string, tempDir: string): BinaryUpgradeResult {
  try {
    const command = createWindowsReplacementCommand(tempPath, executablePath, tempDir, process.pid)
    const proc = Bun.spawn([
      'powershell.exe',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-WindowStyle',
      'Hidden',
      '-Command',
      command,
    ], {
      stdio: ['ignore', 'ignore', 'ignore'] as const,
      windowsHide: true,
    })

    proc.unref?.()
    return {
      success: true,
    }
  }
  catch (error) {
    return createBinaryFailure('locked', 'Failed to schedule Windows binary replacement.', error)
  }
}

function createWindowsReplacementCommand(tempPath: string, executablePath: string, tempDir: string, pid: number): string {
  const escapedTempPath = escapePowerShellString(tempPath)
  const escapedExecutablePath = escapePowerShellString(executablePath)
  const escapedTempDir = escapePowerShellString(tempDir)

  return [
    `$pidToWait = ${pid}`,
    `$tempPath = '${escapedTempPath}'`,
    `$targetPath = '${escapedExecutablePath}'`,
    `$tempDir = '${escapedTempDir}'`,
    `while (Get-Process -Id $pidToWait -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 200 }`,
    `for ($attempt = 0; $attempt -lt 50; $attempt++) {`,
    `  try {`,
    `    Remove-Item -LiteralPath $targetPath -Force -ErrorAction Stop`,
    `    break`,
    `  }`,
    `  catch {`,
    `    Start-Sleep -Milliseconds 200`,
    `  }`,
    `}`,
    `Move-Item -LiteralPath $tempPath -Destination $targetPath -Force`,
    `Remove-Item -LiteralPath $tempDir -Force -Recurse -ErrorAction SilentlyContinue`,
  ].join('; ')
}

function escapePowerShellString(value: string): string {
  return value.replaceAll('\'', '\'\'')
}

function createBinaryFailure(
  kind: SelfUpgradeErrorKind,
  message: string,
  detail?: unknown,
): BinaryUpgradeResult {
  return {
    error: {
      detail,
      kind,
      message,
    },
    success: false,
  }
}

function resolveBinaryErrorKind(error: unknown): SelfUpgradeErrorKind {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''

  if (code === 'EACCES' || code === 'EPERM')
    return 'permission'

  if (code === 'EBUSY')
    return 'locked'

  return 'unknown'
}
