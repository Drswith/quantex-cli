import { spawn } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import process from 'node:process'
import { text as readText } from 'node:stream/consumers'
import { describe, expect, it } from 'vitest'

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
        QTX_CANCELLATION_SMOKE_TIMEOUT_MS: '250',
        QTX_FAKE_CARGO_LOG: fakeCargoLog,
        USERPROFILE: homeDir,
      })

      expect(output.exitCode, output.stderr).toBe(0)
      expect(output.durationMs).toBeLessThan(4_000)
      expect(output.stdout).toContain('"code": "TIMEOUT"')
      expect(output.stdout).not.toContain('installed successfully')

      const state = await readJsonFile(join(homeDir, '.quantex', 'state.json'))
      expect(state?.installedAgents?.['cargo-cancel-smoke-agent']).toBeUndefined()

      const log = await readFile(fakeCargoLog, 'utf8')
      expect(log).toContain('cargo --version')
      expect(log).toContain('cargo install cargo-cancel-smoke-agent')
      expect(log).not.toContain('fake cargo completed without cancellation')
      if (process.platform !== 'win32') expect(log).toContain('fake cargo received SIGTERM')
    } finally {
      await rm(sandboxRoot, { force: true, recursive: true })
    }
  })
})

async function installFakeCargo(fakeBinDir: string, logPath: string): Promise<void> {
  await mkdir(fakeBinDir, { recursive: true })
  const fakeCargoModule = join(fakeBinDir, 'fake-cargo.mjs')
  const fakeCargoSource = [
    "import { appendFileSync } from 'node:fs'",
    "import process from 'node:process'",
    'const args = process.argv.slice(2)',
    'const logPath = process.env.QTX_FAKE_CARGO_LOG',
    'if (!logPath) throw new Error("QTX_FAKE_CARGO_LOG is required")',
    'const log = message => appendFileSync(logPath, `${message}\\n`)',
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
    'setTimeout(() => complete("fake cargo completed without cancellation"), 10_000)',
  ].join('\n')
  await writeFile(fakeCargoModule, fakeCargoSource, 'utf8')

  if (process.platform === 'win32') {
    await writeFile(join(fakeBinDir, 'cargo.cmd'), ['@echo off', 'bun "%~dp0fake-cargo.mjs" %*'].join('\r\n'), 'utf8')
    return
  }

  const fakeCargoPath = join(fakeBinDir, 'cargo')
  await writeFile(
    fakeCargoPath,
    ['#!/usr/bin/env sh', 'exec bun "$(dirname "$0")/fake-cargo.mjs" "$@"', ''].join('\n'),
    'utf8',
  )
  await chmod(fakeCargoPath, 0o755)
}

async function runCommand(command: string[], env: Record<string, string>): Promise<CommandOutput> {
  const startedAt = Date.now()
  const [file, ...args] = command
  const proc = spawn(file!, args, {
    env: {
      ...process.env,
      ...env,
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const timeout = setTimeout(() => {
    proc.kill('SIGTERM')
  }, 10_000)

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
