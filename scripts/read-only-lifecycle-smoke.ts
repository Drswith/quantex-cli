import type { CommandResult } from '../src/output/types'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseStateDocument } from '../src/state/schema'
import { assertReadOnlyCommand } from './read-only-spawn-guard'
import { resolveExecutableFromPath } from './resolve-executable'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLI_PATH = join(ROOT, 'src', 'cli.ts')
const GUARD_PATH = join(ROOT, 'scripts', 'read-only-spawn-guard.ts')
const BUN_PATH = resolveExecutableFromPath('bun')
const CATALOG_SUPPORT_PATH = join(ROOT, 'src', 'agents', 'generated', 'catalog-support.json')
const FIXTURE_ROOT = join(ROOT, 'test', 'fixtures', 'compatibility', 'v1', 'state')
const COMMANDS = ['list', 'info', 'inspect', 'resolve', 'capabilities', 'doctor'] as const
const FIXTURES = ['absent', 'tracked', 'untracked', 'ghost'] as const
const MODES = ['human', 'json'] as const
const AGENT_COMMANDS = new Set(['info', 'inspect', 'resolve'])
const COMMAND_TIMEOUT_MS = 30_000
const COMMAND_TIMEOUT_GRACE_MS = 1_000
const LEGACY_PASSIVE_NOTICE_MARKER =
  'Quantex CLI 99.0.0 is available (current 0.29.0). Run `quantex doctor` for source-specific update steps.'

type SmokeCommand = (typeof COMMANDS)[number]
type SmokeFixture = (typeof FIXTURES)[number]
type SmokeMode = (typeof MODES)[number]

interface CommandOutput {
  exitCode: number
  stderr: string
  stdout: string
}

interface ChildExitLike {
  kill(signal: NodeJS.Signals): boolean
  once(event: 'close', listener: (code: number | null) => void): unknown
  once(event: 'error', listener: (error: Error) => void): unknown
  removeListener(event: 'close', listener: (code: number | null) => void): unknown
  removeListener(event: 'error', listener: (error: Error) => void): unknown
}

export interface ReadOnlyLifecycleSmokeSummary {
  commands: SmokeCommand[]
  fixtures: SmokeFixture[]
  invocations: number
  modes: SmokeMode[]
  normalizedEvidence: ReadOnlyLifecycleEvidence
}

interface NormalizedCommandEvidence {
  human: string[]
  json: unknown
}

type ReadOnlyLifecycleEvidence = Record<
  SmokeFixture,
  {
    commands: Record<SmokeCommand, NormalizedCommandEvidence>
    fixture: {
      executablePresent: boolean
      recordedInstallType: string | null
    }
  }
>

const INSTALLER_KEYS = ['brew', 'bun', 'cargo', 'deno', 'mise', 'npm', 'pip', 'uv', 'winget'] as const
const FEATURE_KEYS = [
  'assumeYes',
  'cacheBypass',
  'cacheRefresh',
  'channels',
  'colorModes',
  'dryRun',
  'execInstallPolicies',
  'freshnessMetadata',
  'idempotencyKey',
  'logLevels',
  'quietLogs',
  'selfUpgrade',
  'timeout',
] as const

export const READ_ONLY_LIFECYCLE_BASELINE: ReadOnlyLifecycleEvidence = {
  absent: fixtureBaseline(null, false, {
    info: observationBaseline(false, 'unmanaged'),
    inspect: observationBaseline(false, 'unmanaged', undefined, 'command update'),
    list: observationBaseline(false, 'unmanaged', 'detected in PATH', 'command update'),
    resolve: resolveBaseline(false),
  }),
  ghost: fixtureBaseline('npm', false, {
    info: observationBaseline(false, 'managed'),
    inspect: observationBaseline(false, 'managed', undefined, 'managed update'),
    list: observationBaseline(false, 'managed', 'managed via npm (@openai/codex)', 'managed update'),
    resolve: resolveBaseline(false),
  }),
  tracked: fixtureBaseline('bun', true, {
    info: observationBaseline(true, 'managed', 'managed via bun (@openai/codex)'),
    inspect: observationBaseline(true, 'managed', 'managed via bun (@openai/codex)', 'managed update'),
    list: observationBaseline(true, 'managed', 'managed via bun (@openai/codex)', 'managed update'),
    resolve: resolveBaseline(true, 'managed', 'managed via bun (@openai/codex)', 'bun'),
  }),
  untracked: fixtureBaseline(null, true, {
    info: observationBaseline(true, 'unmanaged', 'detected in PATH'),
    inspect: observationBaseline(true, 'unmanaged', 'detected in PATH', 'command update'),
    list: observationBaseline(true, 'unmanaged', 'detected in PATH', 'command update'),
    resolve: resolveBaseline(true, 'unmanaged', 'detected in PATH', 'detected-in-path'),
  }),
}

export async function runReadOnlyLifecycleSmoke(): Promise<ReadOnlyLifecycleSmokeSummary> {
  let invocations = 0
  const normalizedEvidence = {} as ReadOnlyLifecycleEvidence

  for (const fixture of FIXTURES) {
    const sandbox = await createSandbox(fixture)
    const commands = {} as Record<SmokeCommand, NormalizedCommandEvidence>

    try {
      const configBefore = await snapshotDirectory(sandbox.configDir)

      for (const mode of MODES) {
        for (const command of COMMANDS) {
          const output = await runCli(command, fixture, mode, sandbox)
          const evidence = assertCommandOutput(command, fixture, mode, output)
          commands[command] ??= { human: [], json: undefined }
          if (mode === 'human') commands[command].human = evidence as string[]
          else commands[command].json = evidence
          assertDirectorySnapshot(
            await snapshotDirectory(sandbox.configDir),
            configBefore,
            `${fixture}/${mode}/${command}`,
          )
          invocations += 1
        }
      }

      await assertGuardedInvocations(sandbox.guardLogPath)
      normalizedEvidence[fixture] = {
        commands,
        fixture: sandbox.fixtureEvidence,
      }
    } finally {
      await rm(sandbox.root, { force: true, recursive: true })
    }
  }

  assertReadOnlyLifecycleBaseline(normalizedEvidence)

  return {
    commands: [...COMMANDS],
    fixtures: [...FIXTURES],
    invocations,
    modes: [...MODES],
    normalizedEvidence,
  }
}

interface Sandbox {
  env: Record<string, string>
  configDir: string
  fixtureEvidence: {
    executablePresent: boolean
    recordedInstallType: string | null
  }
  guardLogPath: string
  processLogPath: string
  root: string
  statePath: string
}

async function createSandbox(fixture: SmokeFixture): Promise<Sandbox> {
  const root = await mkdtemp(join(tmpdir(), `quantex-readonly-${fixture}-`))
  const home = join(root, 'home')
  const configDir = join(home, '.quantex')
  const binDir = join(root, 'bin')
  const processLogPath = join(root, 'process.log')
  const guardLogPath = join(root, 'guard.log')
  const statePath = join(configDir, 'state.json')

  await mkdir(configDir, { recursive: true })
  await mkdir(binDir, { recursive: true })
  await writeFile(processLogPath, '')
  await writeFile(guardLogPath, '')
  await writeFile(statePath, await prepareStateFixture(fixture))
  await seedVersionCache(configDir)
  await installProcessSentinels(binDir, processLogPath, fixture === 'tracked' || fixture === 'untracked')
  const state = JSON.parse(await readFile(statePath, 'utf8')) as {
    installedAgents?: { codex?: { installType?: unknown } }
  }

  return {
    env: {
      HOME: home,
      LANG: 'C',
      LC_ALL: 'C',
      NO_COLOR: '1',
      PATH: `${binDir}:/usr/bin:/bin`,
      QUANTEX_READ_ONLY_GUARD: '1',
      QUANTEX_READ_ONLY_GUARD_LOG: guardLogPath,
      USERPROFILE: home,
    },
    configDir,
    fixtureEvidence: {
      executablePresent: existsSync(join(binDir, 'codex')),
      recordedInstallType:
        typeof state.installedAgents?.codex?.installType === 'string' ? state.installedAgents.codex.installType : null,
    },
    guardLogPath,
    processLogPath,
    root,
    statePath,
  }
}

async function prepareStateFixture(fixture: SmokeFixture): Promise<string> {
  const legacyFixture = JSON.parse(await readFile(resolveStateFixture(fixture), 'utf8')) as unknown
  if (fixture === 'absent' || fixture === 'tracked') return `${JSON.stringify(legacyFixture, null, 2)}\n`

  const document = parseStateDocument(legacyFixture).document
  return `${JSON.stringify(
    fixture === 'untracked'
      ? { ...document, self: {} }
      : { ...document, self: { ...document.self, installSource: 'source' } },
    null,
    2,
  )}\n`
}

function resolveStateFixture(fixture: SmokeFixture): string {
  if (fixture === 'tracked') return join(FIXTURE_ROOT, 'valid.json')
  if (fixture === 'ghost') return join(FIXTURE_ROOT, 'ghost.json')
  return join(FIXTURE_ROOT, 'untracked.json')
}

async function seedVersionCache(configDir: string): Promise<void> {
  const packages = new Set<string>(['quantex-cli'])
  const catalogSupport = JSON.parse(await readFile(CATALOG_SUPPORT_PATH, 'utf8')) as unknown

  if (isRecord(catalogSupport) && Array.isArray(catalogSupport.agents)) {
    for (const agent of catalogSupport.agents) {
      if (!isRecord(agent) || !isRecord(agent.platforms)) continue
      for (const candidates of Object.values(agent.platforms)) {
        if (!Array.isArray(candidates)) continue
        for (const candidate of candidates) {
          if (isRecord(candidate) && typeof candidate.targetId === 'string') {
            packages.add(candidate.targetId)
          }
        }
      }
    }
  }

  const expiresAt = Date.now() + 24 * 60 * 60 * 1000
  const fetchedAt = Date.now()
  const entries = Object.fromEntries(
    [...packages].flatMap(packageName =>
      ['latest', 'beta'].map(tag => [
        `npm:https://registry.npmjs.org:${packageName}:${tag}`,
        {
          body: JSON.stringify({ version: packageName === 'quantex-cli' ? '99.0.0' : '0.0.0-smoke' }),
          expiresAt,
          fetchedAt,
        },
      ]),
    ),
  )

  const cachePath = join(configDir, 'cache', 'versions.json')
  await mkdir(dirname(cachePath), { recursive: true })
  await writeFile(cachePath, `${JSON.stringify({ entries }, null, 2)}\n`)
}

async function snapshotDirectory(root: string): Promise<Map<string, Buffer>> {
  const snapshot = new Map<string, Buffer>()

  async function visit(directory: string, prefix: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? join(prefix, entry.name) : entry.name
      const absolutePath = join(directory, entry.name)
      if (entry.isDirectory()) await visit(absolutePath, relativePath)
      else snapshot.set(relativePath, await readFile(absolutePath))
    }
  }

  await visit(root, '')
  return snapshot
}

function assertDirectorySnapshot(actual: Map<string, Buffer>, expected: Map<string, Buffer>, label: string): void {
  const actualFiles = [...actual.keys()]
  const expectedFiles = [...expected.keys()]
  assert(
    JSON.stringify(actualFiles) === JSON.stringify(expectedFiles),
    `${label}: config directory entries changed (${expectedFiles.join(', ')} -> ${actualFiles.join(', ')}).`,
  )
  for (const path of expectedFiles) {
    assertBytesEqual(actual.get(path)!, expected.get(path)!, `${label}/${path}`)
  }
}

async function installProcessSentinels(binDir: string, logPath: string, codexPresent: boolean): Promise<void> {
  const observedCommands = [
    'brew',
    'bun',
    'cargo',
    'deno',
    'mise',
    'npm',
    'pip',
    'pip3',
    'python',
    'python3',
    'uv',
    'winget',
  ]

  for (const command of observedCommands) {
    await writeExecutable(
      join(binDir, command),
      `#!/bin/sh\nprintf '%s\\n' '${command} '"$@" >> '${logPath}'\nif [ "$1" = "--version" ]; then\n  ${command === 'bun' ? "printf '%s\\n' '1.3.11'; exit 0" : 'exit 127'}\nfi\nexit 127\n`,
    )
  }

  await writeExecutable(
    join(binDir, 'which'),
    `#!/bin/sh\nprintf '%s\\n' 'which '"$@" >> '${logPath}'\ncase "$1" in\n  */*) [ -x "$1" ] && { printf '%s\\n' "$1"; exit 0; } ;;\nesac\nold_ifs=$IFS\nIFS=:\nfor directory in $PATH; do\n  if [ -x "$directory/$1" ]; then\n    printf '%s\\n' "$directory/$1"\n    IFS=$old_ifs\n    exit 0\n  fi\ndone\nIFS=$old_ifs\nexit 1\n`,
  )

  if (codexPresent) {
    await writeExecutable(
      join(binDir, 'codex'),
      `#!/bin/sh\nprintf '%s\\n' 'codex '"$@" >> '${logPath}'\nif [ "$1" = "--version" ]; then\n  printf '%s\\n' 'codex 1.2.3'\n  exit 0\nfi\nexit 127\n`,
    )
  }
}

async function writeExecutable(path: string, contents: string): Promise<void> {
  await writeFile(path, contents)
  await chmod(path, 0o755)
}

async function runCli(
  command: SmokeCommand,
  fixture: SmokeFixture,
  mode: SmokeMode,
  sandbox: Sandbox,
): Promise<CommandOutput> {
  const args = [
    BUN_PATH,
    '--preload',
    GUARD_PATH,
    CLI_PATH,
    '--output',
    mode,
    '--non-interactive',
    '--color',
    'never',
    '--run-id',
    `readonly-${fixture}-${mode}-${command}`,
    command,
    ...(AGENT_COMMANDS.has(command) ? ['codex'] : []),
  ]
  const child = spawn(args[0]!, args.slice(1), {
    cwd: ROOT,
    env: sandbox.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []
  child.stdout.on('data', chunk => stdoutChunks.push(Buffer.from(chunk)))
  child.stderr.on('data', chunk => stderrChunks.push(Buffer.from(chunk)))
  const exitCode = await waitForChildExit(child, {
    commandLabel: `${fixture}/${mode}/${command}`,
    graceMs: COMMAND_TIMEOUT_GRACE_MS,
    timeoutMs: COMMAND_TIMEOUT_MS,
  })

  return {
    exitCode,
    stderr: Buffer.concat(stderrChunks).toString('utf8'),
    stdout: Buffer.concat(stdoutChunks).toString('utf8'),
  }
}

export function waitForChildExit(
  child: ChildExitLike,
  options: { commandLabel: string; graceMs: number; timeoutMs: number },
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let graceTimer: ReturnType<typeof setTimeout> | undefined
    let timedOut = false
    const timeoutError = () => new Error(`${options.commandLabel} timed out after ${options.timeoutMs}ms.`)
    const finish = (result: { error: Error } | { exitCode: number }) => {
      clearTimeout(timeoutTimer)
      if (graceTimer) clearTimeout(graceTimer)
      child.removeListener('close', onClose)
      child.removeListener('error', onError)
      if ('error' in result) reject(result.error)
      else resolve(result.exitCode)
    }
    const onClose = (code: number | null) => {
      if (timedOut) finish({ error: timeoutError() })
      else finish({ exitCode: code ?? 1 })
    }
    const onError = (error: Error) => finish({ error: timedOut ? timeoutError() : error })
    const timeoutTimer = setTimeout(() => {
      timedOut = true
      try {
        child.kill('SIGTERM')
      } catch {
        // Continue to the bounded hard-kill fallback.
      }
      graceTimer = setTimeout(() => {
        try {
          child.kill('SIGKILL')
        } catch {
          // Reject even when the platform cannot deliver SIGKILL.
        }
        finish({ error: timeoutError() })
      }, options.graceMs)
    }, options.timeoutMs)

    child.once('error', onError)
    child.once('close', onClose)
  })
}

function assertCommandOutput(
  command: SmokeCommand,
  fixture: SmokeFixture,
  mode: SmokeMode,
  output: CommandOutput,
): string[] | unknown {
  const shouldResolve = fixture === 'tracked' || fixture === 'untracked'
  const expectedExitCode = command === 'resolve' && !shouldResolve ? 4 : 0

  assert(output.exitCode === expectedExitCode, failure(command, fixture, mode, output, 'unexpected exit code'))
  assert(output.stderr.trim() === '', failure(command, fixture, mode, output, 'stderr must stay empty'))

  if (mode === 'human') {
    assert(output.stdout.trim().length > 0, failure(command, fixture, mode, output, 'human stdout is empty'))
    return normalizeHumanEvidence(command, fixture, output.stdout)
  }

  let result: CommandResult<Record<string, unknown>>
  try {
    result = JSON.parse(output.stdout) as CommandResult<Record<string, unknown>>
  } catch (error) {
    throw new Error(failure(command, fixture, mode, output, `structured stdout is not JSON: ${String(error)}`), {
      cause: error,
    })
  }

  assert(result.action === command, `Expected action=${command} for ${fixture}, received ${result.action}.`)
  assert(result.meta.mode === 'json', `Expected JSON mode for ${fixture}/${command}.`)
  assert(result.meta.schemaVersion === '1', `Expected schemaVersion=1 for ${fixture}/${command}.`)
  assert(result.meta.runId === `readonly-${fixture}-${mode}-${command}`, `Unexpected runId for ${fixture}/${command}.`)
  assert(typeof result.meta.timestamp === 'string', `Missing timestamp for ${fixture}/${command}.`)
  assert(typeof result.meta.version === 'string', `Missing CLI version for ${fixture}/${command}.`)
  assert(Array.isArray(result.warnings), `Warnings must be an array for ${fixture}/${command}.`)
  assert(result.target !== undefined, `Missing target for ${fixture}/${command}.`)

  if (command === 'resolve' && !shouldResolve) {
    assert(result.ok === false, `Expected resolve failure for ${fixture}.`)
    assert(result.error?.code === 'AGENT_NOT_INSTALLED', `Expected AGENT_NOT_INSTALLED for ${fixture}.`)
  } else {
    assert(result.ok === true, `Expected ${command} success for ${fixture}.`)
    assert(result.error === null, `Expected null error for ${fixture}/${command}.`)
  }

  assertStableCommandFields(command, fixture, result.data)
  return normalizeJsonEvidence(command, result)
}

function normalizeJsonEvidence(command: SmokeCommand, result: CommandResult<Record<string, unknown>>): unknown {
  const data = result.data
  assert(isRecord(data), `Missing normalized data for ${command}.`)

  if (command === 'list') {
    const agents = data.agents
    assert(Array.isArray(agents), 'Missing list agents while normalizing evidence.')
    const codex = agents.find(agent => isRecord(agent) && agent.name === 'codex')
    assert(isRecord(codex), 'Missing Codex list row while normalizing evidence.')
    return pickObservation(codex, true)
  }

  if (command === 'info' || command === 'inspect') {
    assert(isRecord(data.inspection), `Missing ${command} inspection while normalizing evidence.`)
    return pickObservation(data.inspection, command === 'inspect')
  }

  if (command === 'resolve') {
    assert(isRecord(data.resolution), 'Missing resolve resolution while normalizing evidence.')
    const guidance = isRecord(data.resolution.installGuidance) ? data.resolution.installGuidance : undefined
    return {
      errorCode: result.error?.code ?? null,
      guidance: guidance
        ? {
            docsRef: guidance.docsRef,
            suggestedAction: guidance.suggestedAction,
            suggestedEnsureCommand: guidance.suggestedEnsureCommand,
          }
        : null,
      installed: data.resolution.installed,
      installSource: data.resolution.installSource,
      lifecycle: data.resolution.lifecycle,
      sourceLabel: data.resolution.sourceLabel,
    }
  }

  if (command === 'capabilities') {
    assert(
      isRecord(data.features) && isRecord(data.installers),
      'Missing capabilities shape while normalizing evidence.',
    )
    const installers = data.installers
    return {
      agentMarker: Array.isArray(data.agents) && data.agents.includes('codex'),
      featureKeys: Object.keys(data.features).sort(),
      installerAvailability: Object.fromEntries(
        INSTALLER_KEYS.map(key => [key, isRecord(installers[key]) ? '<availability>' : '<missing>']),
      ),
      installerKeys: Object.keys(data.installers).sort(),
      outputModes: data.outputModes,
    }
  }

  assert(Array.isArray(data.agents) && Array.isArray(data.issues), 'Missing doctor shape while normalizing evidence.')
  assert(isRecord(data.installers) && isRecord(data.self), 'Missing doctor markers while normalizing evidence.')
  const codex = data.agents.find(agent => isRecord(agent) && agent.displayName === 'Codex CLI')
  return {
    agent: isRecord(codex)
      ? {
          lifecycle: codex.lifecycle,
          sourceLabel: codex.sourceLabel,
        }
      : null,
    installerKeys: Object.keys(data.installers).sort(),
    issueCodes: data.issues
      .flatMap(issue => (isRecord(issue) && typeof issue.code === 'string' ? [issue.code] : []))
      .sort(),
    selfKeys: Object.keys(data.self).sort(),
  }
}

function pickObservation(value: Record<string, any>, includeUpdateLabel: boolean): unknown {
  return {
    installed: value.installed,
    lifecycle: value.lifecycle,
    sourceLabel: value.sourceLabel ?? null,
    ...(includeUpdateLabel ? { updateLabel: value.updateLabel } : {}),
  }
}

function normalizeHumanEvidence(command: SmokeCommand, fixture: SmokeFixture, stdout: string): string[] {
  const normalized = stdout.replace(/\s+/g, ' ').trim()
  assert(
    !normalized.includes(LEGACY_PASSIVE_NOTICE_MARKER),
    `${fixture}/human/${command}: ordinary command emitted the legacy implicit self-update notice.`,
  )
  const markers = READ_ONLY_LIFECYCLE_BASELINE[fixture].commands[command].human
  for (const marker of markers) {
    assert(normalized.includes(marker), `${fixture}/human/${command}: missing compatibility marker "${marker}".`)
  }
  return [...markers]
}

function assertStableCommandFields(command: SmokeCommand, fixture: SmokeFixture, data: unknown): void {
  assert(isRecord(data), `Missing structured data for ${fixture}/${command}.`)

  if (command === 'list') {
    assert(Array.isArray(data.agents), `list.agents must be an array for ${fixture}.`)
    assert(
      data.agents.some(agent => isRecord(agent) && agent.name === 'codex'),
      `list must include codex for ${fixture}.`,
    )
  } else if (command === 'info' || command === 'inspect') {
    assert(isRecord(data.agent) && data.agent.name === 'codex', `${command}.agent.name must be codex for ${fixture}.`)
    assert(isRecord(data.inspection), `${command}.inspection is missing for ${fixture}.`)
    assert(
      typeof data.inspection.installed === 'boolean',
      `${command}.inspection.installed is unstable for ${fixture}.`,
    )
  } else if (command === 'resolve') {
    assert(isRecord(data.agent) && data.agent.name === 'codex', `resolve.agent.name must be codex for ${fixture}.`)
    assert(isRecord(data.resolution), `resolve.resolution is missing for ${fixture}.`)
    assert(typeof data.resolution.installed === 'boolean', `resolve.resolution.installed is unstable for ${fixture}.`)
  } else if (command === 'capabilities') {
    assert(Array.isArray(data.agents), `capabilities.agents must be an array for ${fixture}.`)
    assert(isRecord(data.installers), `capabilities.installers is missing for ${fixture}.`)
    for (const installer of Object.values(data.installers)) {
      assert(isRecord(installer) && typeof installer.available === 'boolean', 'Installer availability must be boolean.')
    }
  } else {
    assert(Array.isArray(data.agents), `doctor.agents must be an array for ${fixture}.`)
    assert(Array.isArray(data.issues), `doctor.issues must be an array for ${fixture}.`)
    assert(isRecord(data.installers), `doctor.installers is missing for ${fixture}.`)
    assert(isRecord(data.self), `doctor.self is missing for ${fixture}.`)
  }
}

export function assertReadOnlyLifecycleBaseline(value: unknown): void {
  if (stableJson(value) !== stableJson(READ_ONLY_LIFECYCLE_BASELINE)) {
    throw new Error(
      `Read-only lifecycle evidence does not match the deterministic compatibility baseline.\nActual: ${JSON.stringify(value, null, 2)}\nExpected: ${JSON.stringify(READ_ONLY_LIFECYCLE_BASELINE, null, 2)}`,
    )
  }
}

export function formatReadOnlyLifecycleSummary(normalizedEvidence: unknown): string {
  return stableJson({
    kind: 'read-only-lifecycle-smoke',
    normalizedEvidence,
  })
}

function fixtureBaseline(
  recordedInstallType: string | null,
  executablePresent: boolean,
  observations: Record<'info' | 'inspect' | 'list' | 'resolve', unknown>,
): ReadOnlyLifecycleEvidence[SmokeFixture] {
  const installed = executablePresent
  const source = recordedInstallType
    ? `managed via ${recordedInstallType} (@openai/codex)`
    : installed
      ? 'detected in PATH'
      : undefined
  const installedHuman = installed ? ['Installed: Yes'] : ['Installed: No']
  const inspectHuman = [
    ...installedHuman,
    recordedInstallType ? 'Update Mode: managed update' : 'Update Mode: command update',
  ]
  if (installed && source) {
    installedHuman.push(`Source: ${source}`)
    inspectHuman.push(`Source: ${source}`)
  }

  const resolveHuman = installed
    ? [`Source: ${source}`, `Lifecycle: ${recordedInstallType ? 'managed' : 'unmanaged'}`]
    : ['Codex CLI is not installed.', 'Try: quantex ensure codex']
  const doctorHuman = ['Quantex CLI Environment Check', 'Managed Installers:', 'Installed Agents:', 'Issues:']
  if (installed) doctorHuman.push(`[${recordedInstallType ? 'managed' : 'unmanaged'}; ${source}]`)
  else doctorHuman.push('No agents installed')

  return {
    commands: {
      capabilities: {
        human: ['Quantex Capabilities', 'Installers:', 'Features:', 'codex'],
        json: {
          agentMarker: true,
          featureKeys: [...FEATURE_KEYS].sort(),
          installerAvailability: Object.fromEntries(INSTALLER_KEYS.map(key => [key, '<availability>'])),
          installerKeys: [...INSTALLER_KEYS].sort(),
          outputModes: ['human', 'json', 'ndjson'],
        },
      },
      doctor: {
        human: doctorHuman,
        json: {
          agent: installed
            ? {
                lifecycle: recordedInstallType ? 'managed' : 'unmanaged',
                sourceLabel: source,
              }
            : null,
          installerKeys: [...INSTALLER_KEYS].sort(),
          issueCodes: ['SELF_AUTO_UPDATE_UNAVAILABLE'],
          selfKeys: ['canAutoUpdate', 'currentVersion', 'installSource', 'latestVersion', 'outdated'],
        },
      },
      info: { human: ['Codex CLI', ...installedHuman], json: observations.info },
      inspect: { human: ['Codex CLI', ...inspectHuman], json: observations.inspect },
      list: {
        human: ['AI Agents:', 'Codex CLI', installed ? 'Codex CLI installed' : 'Codex CLI not installed'],
        json: observations.list,
      },
      resolve: {
        human: resolveHuman,
        json: observations.resolve,
      },
    },
    fixture: {
      executablePresent,
      recordedInstallType,
    },
  }
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => {
    if (!isRecord(entry)) return entry
    return Object.fromEntries(Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)))
  })
}

function observationBaseline(
  installed: boolean,
  lifecycle: 'managed' | 'unmanaged',
  sourceLabel?: string,
  updateLabel?: string,
): unknown {
  return {
    installed,
    lifecycle,
    sourceLabel: sourceLabel ?? null,
    ...(updateLabel ? { updateLabel } : {}),
  }
}

function resolveBaseline(
  installed: boolean,
  lifecycle: 'managed' | 'unmanaged' = 'unmanaged',
  sourceLabel = 'not installed',
  installSource = 'not-installed',
): unknown {
  return {
    errorCode: installed ? null : 'AGENT_NOT_INSTALLED',
    guidance: installed
      ? null
      : {
          docsRef: 'skills/quantex-cli/references/command-recipes.md',
          suggestedAction: 'ensure-agent-installed',
          suggestedEnsureCommand: 'quantex ensure codex',
        },
    installed,
    installSource,
    lifecycle,
    sourceLabel,
  }
}

async function assertGuardedInvocations(logPath: string): Promise<void> {
  const log = await readFile(logPath, 'utf8')
  const commands = log
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as unknown)

  assert(commands.length > 0, 'Read-only spawn guard did not observe any child CLI processes.')
  for (const command of commands) {
    assert(
      Array.isArray(command) && command.every(argument => typeof argument === 'string'),
      'Invalid guard log entry.',
    )
    assertReadOnlyCommand(command)
  }
}

function assertBytesEqual(actual: Uint8Array, expected: Uint8Array, label: string): void {
  assert(actual.byteLength === expected.byteLength, `State file size changed during ${label}.`)
  for (let index = 0; index < actual.byteLength; index += 1) {
    assert(actual[index] === expected[index], `State file bytes changed during ${label}.`)
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function failure(
  command: SmokeCommand,
  fixture: SmokeFixture,
  mode: SmokeMode,
  output: CommandOutput,
  message: string,
): string {
  return [
    `${fixture}/${mode}/${command}: ${message}.`,
    `Exit code: ${output.exitCode}`,
    `Stdout: ${output.stdout.trim() || '(empty)'}`,
    `Stderr: ${output.stderr.trim() || '(empty)'}`,
  ].join('\n')
}

if (import.meta.main) {
  const summary = await runReadOnlyLifecycleSmoke()
  console.log(`Read-only lifecycle smoke passed (${summary.invocations} real CLI invocations).`)
  console.log(formatReadOnlyLifecycleSummary(summary.normalizedEvidence))
}
