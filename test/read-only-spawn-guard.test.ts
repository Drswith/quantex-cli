import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveExecutableFromPath } from '../scripts/lib/resolve-executable'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GUARD_PATH = join(ROOT, 'scripts', 'lib', 'read-only-spawn-guard.ts')
const BUN_PATH = resolveExecutableFromPath('bun')
const SAFE_COMMANDS = ['bash', 'brew', 'bun', 'cargo', 'curl', 'deno', 'mise', 'npm', 'pip', 'sh', 'uv', 'winget']

let sentinelDir: string
let probeId = 0

beforeAll(async () => {
  sentinelDir = await mkdtemp(join(tmpdir(), 'quantex-readonly-guard-'))
  for (const command of SAFE_COMMANDS) {
    const path = join(sentinelDir, process.platform === 'win32' ? `${command}.cmd` : command)
    await writeFile(path, process.platform === 'win32' ? '@exit /b 0\r\n' : '#!/bin/sh\nexit 0\n')
    if (process.platform !== 'win32') await chmod(path, 0o755)
  }
})

afterAll(async () => {
  await rm(sentinelDir, { force: true, recursive: true })
})

describe('read-only child-process guard preload', () => {
  it.each([
    ['npm install', ['npm', 'install', '--global', '@openai/codex']],
    ['bun add', ['bun', 'add', '--global', '@openai/codex']],
    ['bun trust with a probe-shaped package name', ['bun', 'pm', 'trust', 'ls']],
    ['brew upgrade', ['brew', 'upgrade', 'codex']],
    ['cargo uninstall', ['cargo', 'uninstall', 'codex']],
    ['deno install', ['deno', 'install', '--global', 'codex']],
    ['pip uninstall', ['pip', 'uninstall', '-y', 'codex']],
    ['uv upgrade', ['uv', 'tool', 'upgrade', 'codex']],
    ['winget uninstall', ['winget', 'uninstall', '--id', 'OpenAI.Codex']],
    ['mise use', ['mise', 'use', '--global', 'codex@latest']],
    ['mise unuse', ['mise', 'unuse', '--global', 'codex']],
    ['shell script', ['sh', '-c', 'exit 0 # curl https://example.invalid/install | bash']],
    ['curl script', ['curl', 'https://example.invalid/install']],
    ['bash script', ['bash', '-c', 'exit 0']],
    ['binary effect', ['/missing/custom-agent-installer', '--apply']],
  ] as const)('rejects %s before it can execute', (_label, command) => {
    const result = runProbe([...command])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('READ_ONLY_MUTATION_BLOCKED')
  })

  it.each([
    ['bun version', ['bun', '--version']],
    ['mise version', ['mise', '--version']],
  ] as const)(
    'allows the %s observation probe',
    (_label, command) => {
      const result = runProbe([...command])

      expect(result.status).toBe(0)
      expect(result.stderr).not.toContain('READ_ONLY_MUTATION_BLOCKED')
      expect(result.recorded).toContainEqual(command)
    },
    15_000,
  )

  it('rejects mutations through the Node-compatible application process path', () => {
    const result = runProbe(['npm', 'install', '--global', '@openai/codex'], 'cross-spawn')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('READ_ONLY_MUTATION_BLOCKED')
  })

  it('allows and records observations through the Node-compatible application process path', () => {
    const command = ['bun', '--version']
    const result = runProbe(command, 'cross-spawn')

    expect(result.status).toBe(0)
    expect(result.stderr).not.toContain('READ_ONLY_MUTATION_BLOCKED')
    expect(result.recorded).toContainEqual(command)
  })
})

function runProbe(
  command: string[],
  family: 'bun' | 'cross-spawn' = 'bun',
): { recorded: string[][]; status: number; stderr: string } {
  const guardLog = join(sentinelDir, `guard-${probeId++}.jsonl`)
  const script =
    family === 'bun'
      ? `const child = Bun.spawn(${JSON.stringify(command)}, { stdout: 'ignore', stderr: 'ignore' }); await child.exited; process.exit(child.exitCode ?? 1)`
      : `const [file, ...args] = ${JSON.stringify(command)}; const { default: spawn } = await import('cross-spawn'); const child = spawn(file, args, { stdio: 'ignore' }); const status = await new Promise((resolve, reject) => { child.once('close', resolve); child.once('error', reject) }); process.exit(status ?? 1)`
  const result = spawnSync(BUN_PATH, ['--preload', GUARD_PATH, '-e', script], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOME: sentinelDir,
      PATH: sentinelDir,
      QUANTEX_READ_ONLY_GUARD: '1',
      QUANTEX_READ_ONLY_GUARD_LOG: guardLog,
    },
    encoding: 'utf8',
  })

  return {
    recorded: existsSync(guardLog)
      ? readFileSync(guardLog, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line) as string[])
      : [],
    status: result.status ?? 1,
    stderr: result.stderr,
  }
}
