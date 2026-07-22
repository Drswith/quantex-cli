import type { ProviderOperationContext } from '../../src/providers'
import type { VersionedQuantexState } from '../../src/state/schema'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createQuantexClient } from '../../src/core/client'
import { createProductionCoreReadPorts } from '../../src/core/production-observation'
import { firstPartyProviderRegistry } from '../../src/providers'
import { createCoreBackedCliReadObservationService } from '../../src/services/core-read-observations'
import { createProductionLifecycleObservationService } from '../../src/services/lifecycle-observations'

const AGENT_NAME = 'commandcode'
const BINARY_NAME = 'command-code'
const PACKAGE_NAME = 'command-code'
const PROVIDER_TIMEOUT_MS = 1_000

describe('legacy/Core read differential gate', () => {
  let root: string
  let binDir: string
  let configDir: string
  let originalHome: string | undefined
  let originalPath: string | undefined
  let originalMode: string | undefined

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'quantex-core-read-differential-'))
    binDir = join(root, 'bin')
    configDir = join(root, '.quantex')
    await mkdir(binDir, { recursive: true })
    await mkdir(configDir, { recursive: true })
    await writeNpmFixture(binDir)
    originalHome = process.env.HOME
    originalPath = process.env.PATH
    originalMode = process.env.QTX_DIFFERENTIAL_NPM_MODE
    process.env.HOME = root
    process.env.PATH = `${binDir}${delimiter}${originalPath ?? ''}`
  })

  afterAll(async () => {
    restoreEnv('HOME', originalHome)
    restoreEnv('PATH', originalPath)
    restoreEnv('QTX_DIFFERENTIAL_NPM_MODE', originalMode)
    await rm(root, { force: true, recursive: true })
  })

  const scenarios: readonly {
    readonly binary: boolean
    readonly input: string
    readonly name: string
    readonly npm: 'absent' | 'present' | 'unknown'
    readonly state?: VersionedQuantexState
  }[] = [
    { binary: true, input: AGENT_NAME, name: 'managed', npm: 'present', state: managedState() },
    { binary: true, input: 'command-code', name: 'alias', npm: 'present', state: managedState() },
    { binary: true, input: AGENT_NAME, name: 'external', npm: 'absent' },
    { binary: false, input: AGENT_NAME, name: 'missing', npm: 'absent' },
    { binary: false, input: AGENT_NAME, name: 'stale', npm: 'absent', state: managedState() },
    { binary: true, input: AGENT_NAME, name: 'conflict', npm: 'present', state: conflictingState() },
    { binary: false, input: AGENT_NAME, name: 'indeterminate', npm: 'unknown' },
  ] as const

  for (const scenario of scenarios) {
    it(`matches the maintained v1 observation for ${scenario.name}`, async () => {
      await configureScenario(binDir, configDir, scenario.binary, scenario.npm, scenario.state)
      const context = operationContext()

      const legacy = await createProductionLifecycleObservationService(context, {
        resolveLatestVersion: false,
      }).resolveAgentObservation(scenario.input)
      const core = await createCoreService(configDir, context).resolveAgentObservation(scenario.input)
      const [fullRegistrySdk, slimRegistrySdk] = await Promise.all([
        createSdkClient(configDir, true).inspect(scenario.input),
        createSdkClient(configDir, false).inspect(scenario.input),
      ])

      expect(withoutTimestamps(core)).toEqual(withoutTimestamps(legacy))
      expect(withoutTimestamps(slimRegistrySdk)).toEqual(withoutTimestamps(fullRegistrySdk))
    }, 20_000)
  }

  it('matches provider timeout projection without turning it into a new CLI-level timeout', async () => {
    await configureScenario(binDir, configDir, false, 'timeout')
    const legacy = await createProductionLifecycleObservationService(operationContext(PROVIDER_TIMEOUT_MS), {
      resolveLatestVersion: false,
    }).resolveAgentObservation(AGENT_NAME)
    const core = await createCoreService(configDir, operationContext(PROVIDER_TIMEOUT_MS)).resolveAgentObservation(
      AGENT_NAME,
    )

    expect(withoutTimestamps(core)).toEqual(withoutTimestamps(legacy))
    expect(core?.observation.kind).toBe('indeterminate')
    expect(core?.providerOutcome?.kind).toBe('timed-out')

    const [fullRegistrySdk, slimRegistrySdk] = await Promise.all([
      createSdkClient(configDir, true).inspect(AGENT_NAME, { timeoutMs: PROVIDER_TIMEOUT_MS }),
      createSdkClient(configDir, false).inspect(AGENT_NAME, { timeoutMs: PROVIDER_TIMEOUT_MS }),
    ])
    expect(slimRegistrySdk).toEqual(fullRegistrySdk)
    expect(slimRegistrySdk).toMatchObject({ error: { code: 'timed-out' }, ok: false })
  }, 20_000)

  it('matches public SDK cancellation across full and slim provider registries', async () => {
    await configureScenario(binDir, configDir, false, 'timeout')
    const fullController = new AbortController()
    const slimController = new AbortController()
    const full = createSdkClient(configDir, true).inspect(AGENT_NAME, { signal: fullController.signal })
    const slim = createSdkClient(configDir, false).inspect(AGENT_NAME, { signal: slimController.signal })
    setTimeout(() => {
      fullController.abort('public-registry-cancel')
      slimController.abort('public-registry-cancel')
    }, 20)

    const [fullRegistrySdk, slimRegistrySdk] = await Promise.all([full, slim])
    expect(slimRegistrySdk).toEqual(fullRegistrySdk)
    expect(slimRegistrySdk).toMatchObject({ error: { code: 'cancelled' }, ok: false })
  }, 20_000)

  it.each([
    ['corrupt', '{not-json'],
    ['future', JSON.stringify({ installedAgents: {}, lifecycleReceipts: {}, schemaVersion: 3, self: {} })],
  ])(
    'fails closed for %s state in the same CLI error domain',
    async (_name, stateText) => {
      await configureScenario(binDir, configDir, false, 'absent')
      await writeFile(join(configDir, 'state.json'), stateText)
      const legacy = createProductionLifecycleObservationService(operationContext(), {
        resolveLatestVersion: false,
      }).resolveAgentObservation(AGENT_NAME)
      const core = createCoreService(configDir, operationContext()).resolveAgentObservation(AGENT_NAME)

      const [legacyError, coreError, fullRegistrySdk, slimRegistrySdk] = await Promise.all([
        captureError(legacy),
        captureError(core),
        createSdkClient(configDir, true).inspect(AGENT_NAME),
        createSdkClient(configDir, false).inspect(AGENT_NAME),
      ])
      expect(coreError.name).toBe(legacyError.name)
      expect(coreError.message).toContain('Failed to read Quantex state file')
      expect(slimRegistrySdk).toEqual(fullRegistrySdk)
      expect(slimRegistrySdk).toMatchObject({ error: { code: 'invalid-state' }, ok: false })
    },
    20_000,
  )
})

function createCoreService(configDir: string, context: ProviderOperationContext) {
  return createCoreBackedCliReadObservationService(context, {
    configDir,
    core: createProductionCoreReadPorts({ providerRegistry: firstPartyProviderRegistry }),
    resolveLatestVersion: async () => undefined,
  })
}

function createSdkClient(configDir: string, fullRegistry: boolean) {
  return createQuantexClient(
    { configDir },
    createProductionCoreReadPorts(fullRegistry ? { providerRegistry: firstPartyProviderRegistry } : {}),
  )
}

function operationContext(timeoutMs?: number): ProviderOperationContext {
  return {
    signal: new AbortController().signal,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  }
}

async function configureScenario(
  binDir: string,
  configDir: string,
  binary: boolean,
  npm: 'absent' | 'present' | 'timeout' | 'unknown',
  state?: ReturnType<typeof managedState>,
): Promise<void> {
  process.env.QTX_DIFFERENTIAL_NPM_MODE = npm
  await rm(join(binDir, executableFileName(BINARY_NAME)), { force: true })
  if (binary) await writeAgentFixture(binDir)
  await rm(join(configDir, 'state.json'), { force: true })
  if (state) await writeFile(join(configDir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`)
}

function managedState(): VersionedQuantexState {
  return {
    installedAgents: {
      [AGENT_NAME]: {
        agentName: AGENT_NAME,
        binaryName: BINARY_NAME,
        installType: 'npm',
        packageName: PACKAGE_NAME,
      },
    },
    lifecycleReceipts: {
      [AGENT_NAME]: {
        executableName: BINARY_NAME,
        kind: 'lifecycle-receipt',
        providerId: 'npm',
        providerTargetId: PACKAGE_NAME,
        providerTargetKind: 'package',
        schemaVersion: 1,
        targetId: AGENT_NAME,
        verifiedAt: '2026-07-22T00:00:00.000Z',
      },
    },
    schemaVersion: 2,
    self: {},
  }
}

function conflictingState(): VersionedQuantexState {
  const state = managedState()
  return {
    ...state,
    lifecycleReceipts: {
      ...state.lifecycleReceipts,
      [AGENT_NAME]: {
        ...state.lifecycleReceipts[AGENT_NAME]!,
        providerTargetId: 'different-package',
      },
    },
  }
}

async function writeNpmFixture(binDir: string): Promise<void> {
  const body =
    process.platform === 'win32'
      ? [
          '@echo off',
          'if "%QTX_DIFFERENTIAL_NPM_MODE%"=="timeout" ping -n 31 127.0.0.1 >nul',
          'if "%QTX_DIFFERENTIAL_NPM_MODE%"=="present" echo {"dependencies":{"command-code":{"version":"1.2.3"}}}',
          'if "%QTX_DIFFERENTIAL_NPM_MODE%"=="absent" echo {"dependencies":{}}',
          'if "%QTX_DIFFERENTIAL_NPM_MODE%"=="unknown" echo {"error":{"code":"fixture"}}',
        ].join('\r\n')
      : [
          '#!/bin/sh',
          'case "$QTX_DIFFERENTIAL_NPM_MODE" in',
          '  timeout) sleep 30 ;;',
          `  present) printf '%s\\n' '${JSON.stringify({ dependencies: { [PACKAGE_NAME]: { version: '1.2.3' } } })}' ;;`,
          `  absent) printf '%s\\n' '${JSON.stringify({ dependencies: {} })}' ;;`,
          `  unknown) printf '%s\\n' '${JSON.stringify({ error: { code: 'fixture' } })}' ;;`,
          'esac',
        ].join('\n')
  await writeExecutable(join(binDir, executableFileName('npm')), body)
}

async function writeAgentFixture(binDir: string): Promise<void> {
  const body =
    process.platform === 'win32'
      ? '@echo off\r\necho command-code 1.2.3\r\n'
      : "#!/bin/sh\nprintf '%s\\n' 'command-code 1.2.3'\n"
  await writeExecutable(join(binDir, executableFileName(BINARY_NAME)), body)
}

async function writeExecutable(path: string, source: string): Promise<void> {
  await writeFile(path, source)
  if (process.platform !== 'win32') await chmod(path, 0o755)
}

function executableFileName(name: string): string {
  return process.platform === 'win32' ? `${name}.cmd` : name
}

function withoutTimestamps<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutTimestamps) as T
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'observedAt')
      .map(([key, entry]) => [key, withoutTimestamps(entry)]),
  ) as T
}

async function captureError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise
    throw new Error('Expected observation to fail.')
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error))
  }
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
