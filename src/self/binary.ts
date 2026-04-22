import type { SelfUpdateResult, SelfUpgradeErrorKind } from './types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { chmod, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

type BinaryUpgradeResult = Omit<SelfUpdateResult, 'installSource'>

export async function upgradeStandaloneBinary(
  downloadUrl: string,
  executablePath: string,
  expectedChecksum: string,
  expectedVersion?: string,
): Promise<BinaryUpgradeResult> {
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
  const backupPath = `${executablePath}.bak`

  try {
    const binary = Buffer.from(await response.arrayBuffer())
    const executableMode = await resolveExecutableMode(executablePath)
    const actualChecksum = getSha256(binary)

    if (actualChecksum !== normalizeChecksum(expectedChecksum)) {
      return createBinaryFailure(
        'checksum',
        `Checksum mismatch for ${downloadUrl}. Expected ${normalizeChecksum(expectedChecksum)}, got ${actualChecksum}.`,
      )
    }

    await writeFile(tempPath, binary)

    if (process.platform === 'win32')
      return scheduleWindowsBinaryReplacement(tempPath, executablePath, backupPath, tempDir, expectedVersion)

    await chmod(tempPath, executableMode)
    await rm(backupPath, { force: true })
    await rename(executablePath, backupPath)
    await rename(tempPath, executablePath)

    const verifyResult = await verifyStandaloneBinary(executablePath, expectedVersion)

    if (!verifyResult.success) {
      await restoreStandaloneBinary(backupPath, executablePath)
      return verifyResult
    }

    await rm(backupPath, { force: true })

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

function scheduleWindowsBinaryReplacement(
  tempPath: string,
  executablePath: string,
  backupPath: string,
  tempDir: string,
  expectedVersion?: string,
): BinaryUpgradeResult {
  try {
    const command = createWindowsReplacementCommand(tempPath, executablePath, backupPath, tempDir, process.pid, expectedVersion)
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

function createWindowsReplacementCommand(
  tempPath: string,
  executablePath: string,
  backupPath: string,
  tempDir: string,
  pid: number,
  expectedVersion?: string,
): string {
  const escapedTempPath = escapePowerShellString(tempPath)
  const escapedExecutablePath = escapePowerShellString(executablePath)
  const escapedBackupPath = escapePowerShellString(backupPath)
  const escapedTempDir = escapePowerShellString(tempDir)
  const escapedExpectedVersion = escapePowerShellString(expectedVersion ?? '')

  return [
    `$pidToWait = ${pid}`,
    `$tempPath = '${escapedTempPath}'`,
    `$targetPath = '${escapedExecutablePath}'`,
    `$backupPath = '${escapedBackupPath}'`,
    `$tempDir = '${escapedTempDir}'`,
    `$expectedVersion = '${escapedExpectedVersion}'`,
    `while (Get-Process -Id $pidToWait -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 200 }`,
    `for ($attempt = 0; $attempt -lt 50; $attempt++) {`,
    `  try {`,
    `    if (Test-Path -LiteralPath $backupPath) { Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue }`,
    `    Move-Item -LiteralPath $targetPath -Destination $backupPath -Force -ErrorAction Stop`,
    `    break`,
    `  }`,
    `  catch {`,
    `    Start-Sleep -Milliseconds 200`,
    `  }`,
    `}`,
    `Move-Item -LiteralPath $tempPath -Destination $targetPath -Force`,
    `if ($expectedVersion -ne '') {`,
    `  $output = & $targetPath --version 2>$null`,
    `  if ($LASTEXITCODE -ne 0 -or ($output -notmatch [regex]::Escape($expectedVersion))) {`,
    `    Remove-Item -LiteralPath $targetPath -Force -ErrorAction SilentlyContinue`,
    `    Move-Item -LiteralPath $backupPath -Destination $targetPath -Force`,
    `    Remove-Item -LiteralPath $tempDir -Force -Recurse -ErrorAction SilentlyContinue`,
    `    exit 1`,
    `  }`,
    `}`,
    `Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue`,
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

async function restoreStandaloneBinary(backupPath: string, executablePath: string): Promise<void> {
  await rm(executablePath, { force: true })
  await rename(backupPath, executablePath)
}

async function verifyStandaloneBinary(executablePath: string, expectedVersion?: string): Promise<BinaryUpgradeResult> {
  if (!expectedVersion)
    return { success: true }

  try {
    const proc = Bun.spawn([executablePath, '--version'], {
      stdio: ['ignore', 'pipe', 'ignore'] as const,
    })
    const stdout = proc.stdout ? await new Response(proc.stdout).text() : ''
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      return createBinaryFailure('verify', `The upgraded Quantex binary exited with code ${exitCode} during verification.`)
    }

    if (!stdout.includes(expectedVersion)) {
      return createBinaryFailure('verify', `The upgraded Quantex binary reported an unexpected version during verification.`)
    }

    return {
      success: true,
    }
  }
  catch (error) {
    return createBinaryFailure('verify', 'Failed to execute the upgraded Quantex binary for verification.', error)
  }
}

function getSha256(binary: Buffer): string {
  return createHash('sha256').update(binary).digest('hex')
}

function normalizeChecksum(checksum: string): string {
  return checksum.trim().toLowerCase()
}
