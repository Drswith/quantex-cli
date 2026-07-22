import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getCommandContracts } from '../../src/command-contract'

interface CommandFamilyFixture {
  aliases: Array<{ args: string[]; canonicalName: string; golden: string }>
  commands: Array<{
    args: string[]
    errorCode?: string
    exitCode: number
    goldens: Record<OutputMode, string>
    name: string
    ok: boolean
    target: { kind: string; name?: string }
  }>
}

type OutputMode = 'human' | 'json' | 'ndjson'

interface ResultEnvelope {
  action: string
  error: { code: string } | null
  meta: { mode: string; schemaVersion: string }
  ok: boolean
  target?: { kind: string; name?: string }
}

interface ResultEvent {
  data: ResultEnvelope
  type: string
}

let fixture: CommandFamilyFixture
let tempHome = ''
const fixtureUrl = new URL('../fixtures/compatibility/v1/command-families.json', import.meta.url)
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))
const bunExecutable = resolveBunExecutable()

beforeAll(async () => {
  fixture = JSON.parse(await readFile(fixtureUrl, 'utf8')) as CommandFamilyFixture
  tempHome = await mkdtemp(join(tmpdir(), 'quantex-v1-command-families-'))
  await mkdir(join(tempHome, '.quantex'), { recursive: true })
  await writeFile(
    join(tempHome, '.quantex', 'config.json'),
    `${JSON.stringify({ networkRetries: 0, networkTimeoutMs: 1 }, null, 2)}\n`,
  )
})

afterAll(async () => {
  await rm(tempHome, { force: true, recursive: true })
})

describe('v1 command-family process compatibility', () => {
  it('locks every stable command family across human, JSON, and NDJSON boundaries', async () => {
    expect(fixture.commands.map(command => command.name)).toEqual(getCommandContracts().map(contract => contract.name))

    for (const command of fixture.commands) {
      for (const mode of ['human', 'json', 'ndjson'] as const) {
        const execution = await runCli(command.args, mode)
        expect(execution.exitCode, `${command.name} ${mode} exit code`).toBe(command.exitCode)
        expect(execution.stderr, `${command.name} ${mode} stderr`).toBe('')

        if (mode === 'human') {
          expect(execution.stdout.trim().length, `${command.name} human stdout`).toBeGreaterThan(0)
        } else {
          if (command.name === 'list' && mode === 'json') {
            expect(
              Buffer.byteLength(execution.stdout),
              'list json exercises output larger than one 8 KiB chunk',
            ).toBeGreaterThan(8 * 1024)
          }
          const envelope =
            mode === 'json'
              ? (JSON.parse(execution.stdout) as ResultEnvelope)
              : getFinalResultEvent(execution.stdout).data
          expect(envelope, `${command.name} ${mode} envelope`).toMatchObject({
            action: command.name,
            error: command.errorCode ? { code: command.errorCode } : null,
            meta: { mode, schemaVersion: '1' },
            ok: command.ok,
            target: command.target,
          })
        }

        command.goldens[mode] = expectGolden(`${command.name} ${mode}`, execution.stdout, mode, command.goldens[mode])
      }
    }

    await persistUpdatedGoldens()
  }, 120_000)

  it('keeps every stable command alias mapped to its canonical action', async () => {
    for (const alias of fixture.aliases) {
      const execution = await runCli(alias.args, 'json')
      const result = JSON.parse(execution.stdout) as ResultEnvelope
      expect(result.action).toBe(alias.canonicalName)
      alias.golden = expectGolden(`${alias.args[0]} alias`, execution.stdout, 'json', alias.golden)
    }

    await persistUpdatedGoldens()
  }, 30_000)

  it('normalizes host-derived managed-installer diagnostics', () => {
    const stableIssue =
      '  - Quantex CLI cannot auto-update from install source "source". Reinstall via bun, npm, or the standalone binary if you want `quantex upgrade` support.'
    const availabilityIssue =
      '  - No managed installer found. Install bun, npm, brew, cargo, deno, mise, pip, uv, or winget before relying on managed lifecycle operations.'

    expect(normalizeOutput(`Issues:\n${availabilityIssue}\n${stableIssue}\n`, 'human')).toBe(
      normalizeOutput(`Issues:\n${stableIssue}\n`, 'human'),
    )
    expect(
      normalizeOutput(
        JSON.stringify({ data: { issues: [{ code: 'NO_MANAGED_INSTALLER' }, { code: 'STABLE_ISSUE' }] } }),
        'json',
      ),
    ).toBe(normalizeOutput(JSON.stringify({ data: { issues: [{ code: 'STABLE_ISSUE' }] } }), 'json'))

    const stableMethod = '    + [managed/mise] mise use --global npm:@openai/codex'
    const platformMethod = '    + [managed/brew (codex)] brew install codex'
    expect(normalizeOutput(`Install Methods:\n${stableMethod}\n${platformMethod}\n`, 'human')).toBe(
      normalizeOutput(`Install Methods:\n${stableMethod}\n`, 'human'),
    )
  })
})

async function runCli(
  args: readonly string[],
  mode: OutputMode,
): Promise<{
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}> {
  const captureDirectory = await mkdtemp(join(tempHome, 'command-capture-'))
  const stdoutPath = join(captureDirectory, 'stdout')
  const stderrPath = join(captureDirectory, 'stderr')
  let stdoutHandle: Awaited<ReturnType<typeof open>> | undefined
  let stderrHandle: Awaited<ReturnType<typeof open>> | undefined
  let captureDirectoryRemoved = false

  try {
    stdoutHandle = await open(stdoutPath, 'w')
    stderrHandle = await open(stderrPath, 'w')
    const child = spawn(bunExecutable, ['src/cli.ts', '--color', 'never', '--output', mode, ...args], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        HOME: tempHome,
        NO_COLOR: '1',
        PATH: '',
        USERPROFILE: tempHome,
      },
      stdio: ['ignore', stdoutHandle.fd, stderrHandle.fd],
    })
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.once('error', reject)
      child.once('close', code => resolve(code ?? 1))
    })
    await Promise.all([stdoutHandle.close(), stderrHandle.close()])
    stdoutHandle = undefined
    stderrHandle = undefined
    const [stdout, stderr] = await Promise.all([readFile(stdoutPath, 'utf8'), readFile(stderrPath, 'utf8')])
    await rm(captureDirectory, { force: true, recursive: true })
    captureDirectoryRemoved = true
    return { exitCode, stderr, stdout }
  } finally {
    await Promise.allSettled([stdoutHandle?.close(), stderrHandle?.close()])
    if (!captureDirectoryRemoved) await rm(captureDirectory, { force: true, recursive: true }).catch(() => {})
  }
}

function expectGolden(label: string, stdout: string, mode: OutputMode, expected: string): string {
  const normalized = normalizeOutput(stdout, mode)
  const actual = createHash('sha256').update(normalized).digest('hex')
  if (process.env.UPDATE_V1_COMMAND_GOLDENS === '1') return actual
  expect(actual, `${label} normalized golden\n${normalized}`).toBe(expected)
  return expected
}

function normalizeOutput(stdout: string, mode: OutputMode): string {
  const normalizedLines = stdout.replaceAll('\r\n', '\n').trimEnd()
  if (mode === 'human') {
    return normalizedLines
      .replaceAll(tempHome, '<HOME>')
      .replaceAll(process.arch, '<arch>')
      .replace(/\b(?:darwin|linux|macos|win32|windows)\b/giu, '<platform>')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu, '<run-id>')
      .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/gu, '<timestamp>')
      .replace(/\bv?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/gu, '<version>')
      .replace(/^(\s*(?:bun|npm|brew|cargo|deno|mise|pip|uv|winget):\s*).*$/gimu, '$1<availability>')
      .replace(/^.*\[managed\/(?:brew|winget)[^\]]*\].*$/gimu, '')
      .replace(/^[ \t]*- No managed installer found\..*(?:\n|$)/gimu, '')
      .replace(/\n{3,}/gu, '\n\n')
      .trimEnd()
  }

  if (mode === 'json') return JSON.stringify(normalizeJson(JSON.parse(normalizedLines) as unknown))
  return normalizedLines
    .split('\n')
    .map(line => JSON.stringify(normalizeJson(JSON.parse(line) as unknown)))
    .join('\n')
}

function normalizeJson(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) {
    const items =
      key === 'installMethods'
        ? value.filter(
            item =>
              item &&
              typeof item === 'object' &&
              !['brew', 'winget'].includes(String((item as { type?: unknown }).type)),
          )
        : key === 'issues'
          ? value.filter(
              item =>
                !item ||
                typeof item !== 'object' ||
                String((item as { code?: unknown }).code) !== 'NO_MANAGED_INSTALLER',
            )
          : value
    return items.map(item => normalizeJson(item))
  }
  if (value && typeof value === 'object') {
    if (key === 'installers') {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map(installer => [installer, '<availability>']),
      )
    }
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [childKey, normalizeJson(childValue, childKey)]),
    )
  }
  if (typeof value !== 'string') return value
  if (['runId', 'timestamp', 'fetchedAt', 'staleAfter'].includes(key ?? '')) return `<${key}>`
  if (['currentVersion', 'latestVersion', 'version'].includes(key ?? '')) return '<version>'
  if (key === 'binaryPath' && value) return '<binary-path>'
  if (key === 'arch') return '<arch>'
  if (key === 'os') return '<platform>'
  return value.replaceAll(tempHome, '<HOME>')
}

function resolveBunExecutable(): string {
  const executableName = process.platform === 'win32' ? 'bun.exe' : 'bun'
  const candidates = [
    basename(process.execPath).toLowerCase().startsWith('bun') ? process.execPath : undefined,
    process.env.BUN_INSTALL ? join(process.env.BUN_INSTALL, 'bin', executableName) : undefined,
    ...(process.env.PATH ?? '')
      .split(delimiter)
      .filter(Boolean)
      .map(directory => join(directory, executableName)),
  ]
  const executable = candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)))
  if (!executable) throw new Error('The v1 process compatibility gate requires an absolute Bun executable.')
  return executable
}

async function persistUpdatedGoldens(): Promise<void> {
  if (process.env.UPDATE_V1_COMMAND_GOLDENS !== '1') return
  await writeFile(fixtureUrl, `${JSON.stringify(fixture, null, 2)}\n`)
}

function getFinalResultEvent(stdout: string): ResultEvent {
  const events = stdout
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as ResultEvent)
  const result = events.findLast(event => event.type === 'result')
  if (!result) throw new Error(`NDJSON output did not contain a result event.\n${stdout}`)
  return result
}
