import { spawn } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import process from 'node:process'
import { text as readText } from 'node:stream/consumers'
import { describe, expect, it } from 'vitest'
import { terminateWindowsProcessTree } from '../src/utils/child-process'

interface CommandOutput {
  durationMs: number
  exitCode: number
  stderr: string
  stdout: string
}

describe('managed installer cancellation e2e', () => {
  it('times out a Cargo-managed install in an isolated sandbox without persisting success', async () => {
    const sandboxRoot = await mkdtemp(join(tmpdir(), 'quantex-cancel-e2e-'))
    const fakeBinDir = join(sandboxRoot, 'bin')
    const homeDir = join(sandboxRoot, 'home')
    const fakeCargoLog = join(sandboxRoot, 'fake-cargo.log')

    try {
      await mkdir(homeDir, { recursive: true })
      await installFakeCargo(fakeBinDir, fakeCargoLog)

      const output = await runCommand(['bun', 'run', 'scripts/managed-installer-cancellation-smoke.ts'], {
        HOME: homeDir,
        PATH: `${fakeBinDir}${delimiter}${process.env.PATH ?? ''}`,
        QTX_CANCELLATION_SMOKE_TIMEOUT_MS: '10000',
        QTX_FAKE_CARGO_LOG: fakeCargoLog,
        USERPROFILE: homeDir,
      })

      expect(output.exitCode, output.stderr).toBe(0)
      expect(output.stdout).toContain('"code": "TIMEOUT"')
      expect(output.stdout).not.toContain('installed successfully')

      const state = await readJsonFile(join(homeDir, '.quantex', 'state.json'))
      expect(state?.installedAgents?.['cargo-cancel-smoke-agent']).toBeUndefined()
      expect(state?.lifecycleReceipts?.['cargo-cancel-smoke-agent']).toBeUndefined()

      const log = await readFile(fakeCargoLog, 'utf8')
      expect(log).toContain('cargo --version')
      expect(log).toContain('cargo install cargo-cancel-smoke-agent')
      expect(log).not.toContain('fake cargo completed without cancellation')
      if (process.platform !== 'win32') expect(log).toContain('fake cargo received SIGTERM')

      const installerPid = Number(log.match(/fake cargo pid (\d+)/)?.[1])
      expect(Number.isInteger(installerPid)).toBe(true)
      await expectProcessToExit(installerPid)

      const stateAfterCancellation = await readFileIfPresent(join(homeDir, '.quantex', 'state.json'))
      const logAfterCancellation = await readFile(fakeCargoLog, 'utf8')
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(await readFileIfPresent(join(homeDir, '.quantex', 'state.json'))).toEqual(stateAfterCancellation)
      expect(await readFile(fakeCargoLog, 'utf8')).toBe(logAfterCancellation)
    } finally {
      await rm(sandboxRoot, { force: true, recursive: true })
    }
  }, 60_000)
})

async function installFakeCargo(fakeBinDir: string, logPath: string): Promise<void> {
  await mkdir(fakeBinDir, { recursive: true })
  const fakeCargoModule = join(fakeBinDir, 'fake-cargo.cjs')
  const fakeCargoSource = [
    "const { appendFileSync } = require('node:fs')",
    'const args = process.argv.slice(2)',
    'const logPath = process.env.QTX_FAKE_CARGO_LOG',
    'if (!logPath) throw new Error("QTX_FAKE_CARGO_LOG is required")',
    'const log = message => appendFileSync(logPath, `${message}\\n`)',
    'log(`fake cargo pid ${process.pid}`)',
    'log(`cargo ${args.join(" ")}`)',
    'if (args[0] === "--version") {',
    '  console.log("cargo 1.88.0")',
    '  process.exit(0)',
    '}',
    'if (args[0] !== "install") process.exit(0)',
    'const complete = message => {',
    '  log(message)',
    '  setTimeout(() => process.exit(0), 25)',
    '}',
    'process.on("SIGTERM", () => complete("fake cargo received SIGTERM"))',
    'process.on("SIGINT", () => complete("fake cargo received SIGINT"))',
    'setTimeout(() => complete("fake cargo completed without cancellation"), 30_000)',
  ].join('\n')

  if (process.platform === 'win32') {
    await writeFile(fakeCargoModule, fakeCargoSource, 'utf8')
    await writeFile(join(fakeBinDir, 'cargo.cmd'), ['@echo off', 'node "%~dp0fake-cargo.cjs" %*'].join('\r\n'), 'utf8')
    return
  }

  const fakeCargoPath = join(fakeBinDir, 'cargo')
  await writeFile(fakeCargoPath, ['#!/usr/bin/env node', fakeCargoSource, ''].join('\n'), 'utf8')
  await chmod(fakeCargoPath, 0o755)
}

async function runCommand(command: string[], env: Record<string, string>): Promise<CommandOutput> {
  const startedAt = Date.now()
  const [file, ...args] = command
  const proc = spawn(file!, args, {
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      ...env,
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const timeout = setTimeout(() => {
    proc.kill('SIGTERM')
  }, 45_000)
  const forceTimeout = setTimeout(() => void forceKillTestProcessTree(proc), 46_000)

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      readText(proc.stdout),
      readText(proc.stderr),
      waitForChild(proc),
    ])

    return {
      durationMs: Date.now() - startedAt,
      exitCode,
      stderr,
      stdout,
    }
  } finally {
    clearTimeout(timeout)
    clearTimeout(forceTimeout)
    await forceKillTestProcessTree(proc)
  }
}

async function forceKillTestProcessTree(proc: ReturnType<typeof spawn>): Promise<void> {
  if (!proc.pid) return
  if (process.platform === 'win32') await terminateWindowsProcessTree(proc.pid)
  else {
    try {
      process.kill(-proc.pid, 'SIGKILL')
    } catch {
      // Fall through to the direct child kill when the process group already exited.
    }
  }
  try {
    proc.kill('SIGKILL')
  } catch {
    // The child may have exited between the liveness check and forced cleanup.
  }
}

async function waitForChild(proc: ReturnType<typeof spawn>): Promise<number> {
  return new Promise((resolve, reject) => {
    proc.once('error', reject)
    proc.once('close', code => resolve(typeof code === 'number' ? code : 1))
  })
}

async function readJsonFile(path: string): Promise<any | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return undefined
  }
}

async function readFileIfPresent(path: string): Promise<Uint8Array | undefined> {
  try {
    return await readFile(path)
  } catch {
    return undefined
  }
}

async function expectProcessToExit(pid: number): Promise<void> {
  const deadline = Date.now() + 2_000
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  expect(isProcessAlive(pid), `installer process ${pid} should have exited`).toBe(false)
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}
