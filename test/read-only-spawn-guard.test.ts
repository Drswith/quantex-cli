import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GUARD_PATH = join(ROOT, 'scripts', 'read-only-spawn-guard.ts')
const BUN_PATH = resolveExecutable('bun')
const SAFE_COMMANDS = ['bash', 'brew', 'bun', 'cargo', 'curl', 'deno', 'mise', 'npm', 'pip', 'sh', 'uv', 'winget']

let sentinelDir: string

beforeAll(async () => {
  sentinelDir = await mkdtemp(join(tmpdir(), 'quantex-readonly-guard-'))
  for (const command of SAFE_COMMANDS) {
    const path = join(sentinelDir, command)
    await writeFile(path, '#!/bin/sh\nexit 0\n')
    await chmod(path, 0o755)
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
    },
    15_000,
  )
})

function runProbe(command: string[]): { status: number; stderr: string } {
  const script = `const child = Bun.spawn(${JSON.stringify(command)}, { stdout: 'ignore', stderr: 'ignore' }); await child.exited; process.exit(child.exitCode ?? 1)`
  const result = spawnSync(BUN_PATH, ['--preload', GUARD_PATH, '-e', script], {
    cwd: ROOT,
    env: {
      HOME: sentinelDir,
      PATH: sentinelDir,
      QUANTEX_READ_ONLY_GUARD: '1',
    },
    encoding: 'utf8',
  })

  return {
    status: result.status ?? 1,
    stderr: result.stderr,
  }
}

function resolveExecutable(command: string): string {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(directory, command)
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`Unable to resolve ${command}.`)
}
