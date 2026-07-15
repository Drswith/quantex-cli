import type { NetworkPort, ProcessPort } from '../runtime'
import type { SelfUpdateResult, SelfUpgradeErrorKind } from './types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { chmod, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, win32 } from 'node:path'
import process from 'node:process'
import { ProcessInterruptionError, readProcessOutput, spawnCommand } from '../utils/child-process'

type BinaryUpgradeResult = Omit<SelfUpdateResult, 'installSource'>

export interface StandaloneBinaryRuntimeOptions {
  readonly networkPort?: NetworkPort
  readonly processPort?: ProcessPort
  readonly signal: AbortSignal
  readonly timeoutMs?: number
}

export async function upgradeStandaloneBinary(
  downloadUrl: string,
  executablePath: string,
  expectedChecksum: string,
  expectedVersion?: string,
  windowsPeerExecutablePath: string | undefined = getWindowsStandaloneBinaryPeerPath(executablePath),
  runtime?: StandaloneBinaryRuntimeOptions,
): Promise<BinaryUpgradeResult> {
  const networkPort = runtime?.networkPort
  const downloaded =
    networkPort && runtime
      ? await downloadBinaryWithPort(downloadUrl, { ...runtime, networkPort })
      : await downloadBinaryWithFetch(downloadUrl)
  if (downloaded.kind === 'failure') return downloaded.result
  const binary = downloaded.binary
  throwIfBinaryUpgradeCancelled(runtime)

  const tempDir = await mkdtemp(join(dirname(executablePath), '.quantex-upgrade-'))
  const tempPath = join(tempDir, basename(executablePath))
  const backupPath = `${executablePath}.bak`
  let rollbackAvailable = false
  let windowsReplacementScheduled = false

  try {
    throwIfBinaryUpgradeCancelled(runtime)
    const executableMode = await resolveExecutableMode(executablePath)
    const actualChecksum = getSha256(binary)

    if (actualChecksum !== normalizeChecksum(expectedChecksum)) {
      return createBinaryFailure(
        'checksum',
        `Checksum mismatch for ${downloadUrl}. Expected ${normalizeChecksum(expectedChecksum)}, got ${actualChecksum}.`,
      )
    }

    await writeFile(tempPath, binary)
    throwIfBinaryUpgradeCancelled(runtime)

    if (process.platform === 'win32') {
      const result = scheduleWindowsBinaryReplacement(
        tempPath,
        executablePath,
        backupPath,
        tempDir,
        expectedVersion,
        windowsPeerExecutablePath,
      )
      windowsReplacementScheduled = result.success
      return result
    }

    await chmod(tempPath, executableMode)
    throwIfBinaryUpgradeCancelled(runtime)
    await rm(backupPath, { force: true })
    await rename(executablePath, backupPath)
    rollbackAvailable = true

    await rename(tempPath, executablePath)

    const verifyResult = await verifyStandaloneBinary(executablePath, expectedVersion, runtime)

    if (!verifyResult.success) {
      await restoreStandaloneBinary(backupPath, executablePath)
      rollbackAvailable = false
      return verifyResult
    }

    // Verified binary is live; do not treat backup cleanup failures as swap failures.
    rollbackAvailable = false

    await rm(backupPath, { force: true })

    return {
      success: true,
    }
  } catch (error) {
    if (rollbackAvailable) {
      try {
        await restoreStandaloneBinary(backupPath, executablePath)
      } catch {
        // Best-effort rollback; primary failure is reported below.
      }
      rollbackAvailable = false
    }

    if (error instanceof ProcessInterruptionError) throw error

    return createBinaryFailure(resolveBinaryErrorKind(error), 'Failed to replace the current Quantex binary.', error)
  } finally {
    if (process.platform !== 'win32' || !windowsReplacementScheduled)
      await rm(tempDir, { recursive: true, force: true })
  }
}

function throwIfBinaryUpgradeCancelled(runtime: StandaloneBinaryRuntimeOptions | undefined): void {
  if (!runtime?.signal.aborted) return
  throw new ProcessInterruptionError({
    kind: 'cancelled',
    reason:
      runtime.signal.reason instanceof Error ? runtime.signal.reason.message : String(runtime.signal.reason ?? ''),
  })
}

type BinaryDownloadResult =
  | { readonly binary: Buffer; readonly kind: 'success' }
  | { readonly kind: 'failure'; readonly result: BinaryUpgradeResult }

async function downloadBinaryWithFetch(downloadUrl: string): Promise<BinaryDownloadResult> {
  let response: Response
  try {
    response = await fetch(downloadUrl)
  } catch (error) {
    return { kind: 'failure', result: createBinaryFailure('network', `Failed to download ${downloadUrl}.`, error) }
  }
  if (!response.ok)
    return {
      kind: 'failure',
      result: createBinaryFailure('network', `Failed to download ${downloadUrl}: HTTP ${response.status}.`),
    }
  return { binary: Buffer.from(await response.arrayBuffer()), kind: 'success' }
}

async function downloadBinaryWithPort(
  downloadUrl: string,
  runtime: StandaloneBinaryRuntimeOptions & { readonly networkPort: NetworkPort },
): Promise<BinaryDownloadResult> {
  const outcome = await runtime.networkPort.request({
    signal: runtime.signal,
    timeoutMs: runtime.timeoutMs,
    url: downloadUrl,
  })
  if (outcome.kind === 'failure') {
    if (outcome.error.kind === 'cancelled')
      throw new ProcessInterruptionError({ kind: 'cancelled', reason: outcome.error.message })
    if (outcome.error.kind === 'timed-out')
      throw new ProcessInterruptionError({ kind: 'timed-out', timeoutMs: runtime.timeoutMs ?? 0 })
    return {
      kind: 'failure',
      result: createBinaryFailure('network', `Failed to download ${downloadUrl}.`, outcome.error),
    }
  }
  if (outcome.value.status < 200 || outcome.value.status >= 300)
    return {
      kind: 'failure',
      result: createBinaryFailure('network', `Failed to download ${downloadUrl}: HTTP ${outcome.value.status}.`),
    }
  return { binary: Buffer.from(outcome.value.body), kind: 'success' }
}

export function getWindowsStandaloneBinaryPeerPath(executablePath: string): string | undefined {
  if (process.platform !== 'win32') return undefined

  const executableName = win32.basename(executablePath).toLowerCase()
  if (executableName === 'qtx.exe') return win32.join(win32.dirname(executablePath), 'quantex.exe')
  if (executableName === 'quantex.exe') return win32.join(win32.dirname(executablePath), 'qtx.exe')

  return undefined
}

async function resolveExecutableMode(executablePath: string): Promise<number> {
  try {
    return (await stat(executablePath)).mode & 0o777
  } catch {
    return 0o755
  }
}

function scheduleWindowsBinaryReplacement(
  tempPath: string,
  executablePath: string,
  backupPath: string,
  tempDir: string,
  expectedVersion?: string,
  peerExecutablePath?: string,
): BinaryUpgradeResult {
  try {
    const command = createWindowsReplacementCommand(
      tempPath,
      executablePath,
      backupPath,
      tempDir,
      process.pid,
      expectedVersion,
      peerExecutablePath,
    )
    const proc = spawnCommand(
      [
        'powershell.exe',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-WindowStyle',
        'Hidden',
        '-Command',
        command,
      ],
      {
        stdio: ['ignore', 'ignore', 'ignore'] as const,
        windowsHide: true,
      },
    )

    proc.unref()
    return {
      success: true,
    }
  } catch (error) {
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
  peerExecutablePath?: string,
): string {
  const escapedTempPath = escapePowerShellString(tempPath)
  const escapedExecutablePath = escapePowerShellString(executablePath)
  const escapedBackupPath = escapePowerShellString(backupPath)
  const escapedTempDir = escapePowerShellString(tempDir)
  const escapedExpectedVersion = escapePowerShellString(expectedVersion ?? '')
  const escapedPeerExecutablePath = escapePowerShellString(peerExecutablePath ?? '')

  return [
    `$ErrorActionPreference = 'Stop'`,
    `$pidToWait = ${pid}`,
    `$tempPath = '${escapedTempPath}'`,
    `$targetPath = '${escapedExecutablePath}'`,
    `$backupPath = '${escapedBackupPath}'`,
    `$tempDir = '${escapedTempDir}'`,
    `$expectedVersion = '${escapedExpectedVersion}'`,
    `$peerPath = '${escapedPeerExecutablePath}'`,
    `while (Get-Process -Id $pidToWait -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 200 }`,
    `$backupReady = $false`,
    `for ($attempt = 0; $attempt -lt 50; $attempt++) {`,
    `  try {`,
    `    if (Test-Path -LiteralPath $backupPath) { Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue }`,
    `    Move-Item -LiteralPath $targetPath -Destination $backupPath -Force -ErrorAction Stop`,
    `    $backupReady = $true`,
    `    break`,
    `  }`,
    `  catch {`,
    `    Start-Sleep -Milliseconds 200`,
    `  }`,
    `}`,
    `if (-not $backupReady) {`,
    `  Remove-Item -LiteralPath $tempDir -Force -Recurse -ErrorAction SilentlyContinue`,
    `  exit 1`,
    `}`,
    `try {`,
    `  Move-Item -LiteralPath $tempPath -Destination $targetPath -Force`,
    `}`,
    `catch {`,
    `  if (Test-Path -LiteralPath $backupPath) {`,
    `    Move-Item -LiteralPath $backupPath -Destination $targetPath -Force -ErrorAction SilentlyContinue`,
    `  }`,
    `  Remove-Item -LiteralPath $tempDir -Force -Recurse -ErrorAction SilentlyContinue`,
    `  exit 1`,
    `}`,
    `if ($expectedVersion -ne '') {`,
    `  $output = & $targetPath --version 2>$null`,
    `  if ($LASTEXITCODE -ne 0 -or ($output -notmatch [regex]::Escape($expectedVersion))) {`,
    `    Remove-Item -LiteralPath $targetPath -Force -ErrorAction SilentlyContinue`,
    `    Move-Item -LiteralPath $backupPath -Destination $targetPath -Force`,
    `    Remove-Item -LiteralPath $tempDir -Force -Recurse -ErrorAction SilentlyContinue`,
    `    exit 1`,
    `  }`,
    `}`,
    `if ($peerPath -ne '') {`,
    `  Copy-Item -LiteralPath $targetPath -Destination $peerPath -Force`,
    `}`,
    `Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue`,
    `Remove-Item -LiteralPath $tempDir -Force -Recurse -ErrorAction SilentlyContinue`,
  ].join('; ')
}

function escapePowerShellString(value: string): string {
  return value.replaceAll("'", "''")
}

function createBinaryFailure(kind: SelfUpgradeErrorKind, message: string, detail?: unknown): BinaryUpgradeResult {
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

  if (code === 'EACCES' || code === 'EPERM') return 'permission'

  if (code === 'EBUSY') return 'locked'

  return 'unknown'
}

async function restoreStandaloneBinary(backupPath: string, executablePath: string): Promise<void> {
  await rm(executablePath, { force: true })
  await rename(backupPath, executablePath)
}

async function verifyStandaloneBinary(
  executablePath: string,
  expectedVersion?: string,
  runtime?: StandaloneBinaryRuntimeOptions,
): Promise<BinaryUpgradeResult> {
  if (!expectedVersion) return { success: true }

  try {
    if (runtime?.processPort) {
      const outcome = await runtime.processPort.run({
        argv: [executablePath, '--version'],
        signal: runtime.signal,
        stdio: ['ignore', 'pipe', 'ignore'],
        timeoutMs: runtime.timeoutMs,
      })
      if (outcome.kind === 'failure') {
        if (outcome.error.kind === 'cancelled')
          throw new ProcessInterruptionError({ kind: 'cancelled', reason: outcome.error.message })
        if (outcome.error.kind === 'timed-out')
          throw new ProcessInterruptionError({ kind: 'timed-out', timeoutMs: runtime.timeoutMs ?? 0 })
        return createBinaryFailure(
          'verify',
          'Failed to execute the upgraded Quantex binary for verification.',
          outcome.error,
        )
      }
      const stdout = outcome.value.stdout ? new TextDecoder().decode(outcome.value.stdout) : ''
      if (outcome.value.exitCode !== 0)
        return createBinaryFailure(
          'verify',
          `The upgraded Quantex binary exited with code ${outcome.value.exitCode} during verification.`,
        )
      if (!stdout.includes(expectedVersion))
        return createBinaryFailure(
          'verify',
          'The upgraded Quantex binary reported an unexpected version during verification.',
        )
      return { success: true }
    }

    const proc = spawnCommand([executablePath, '--version'], {
      stdio: ['ignore', 'pipe', 'ignore'] as const,
    })
    const { exitCode, stdout } = await readProcessOutput(proc)

    if (exitCode !== 0) {
      return createBinaryFailure(
        'verify',
        `The upgraded Quantex binary exited with code ${exitCode} during verification.`,
      )
    }

    if (!stdout.includes(expectedVersion)) {
      return createBinaryFailure(
        'verify',
        `The upgraded Quantex binary reported an unexpected version during verification.`,
      )
    }

    return {
      success: true,
    }
  } catch (error) {
    if (error instanceof ProcessInterruptionError) throw error
    return createBinaryFailure('verify', 'Failed to execute the upgraded Quantex binary for verification.', error)
  }
}

function getSha256(binary: Buffer): string {
  return createHash('sha256').update(binary).digest('hex')
}

function normalizeChecksum(checksum: string): string {
  return checksum.trim().toLowerCase()
}
