import type { QuantexState } from '../../src/state'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../../src/cli-context'
import { executeCommandWithRuntime } from '../../src/command-runtime'
import { commandsCommand } from '../../src/commands/commands'
import { infoCommand } from '../../src/commands/info'
import { inspectCommand } from '../../src/commands/inspect'
import { listCommand } from '../../src/commands/list'
import { resolveCommand } from '../../src/commands/resolve'
import { cliErrorCodes, getExitCodeForResult } from '../../src/errors'
import * as legacyAgentsService from '../../src/services/agents'
import * as lifecycleObservations from '../../src/services/lifecycle-observations'
import { loadState, StateFileError } from '../../src/state'

interface CompatibilitySurface {
  binaryNames: string[]
  commands: string[]
  errorCodes: string[]
  packageName: string
  schemaVersion: string
}

interface PackageManifest {
  bin: Record<string, string>
  name: string
}

let tempHome = ''

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), 'quantex-v1-compatibility-'))
  vi.stubEnv('HOME', tempHome)
  await mkdir(join(tempHome, '.quantex'), { recursive: true })
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(tempHome, { force: true, recursive: true })
})

describe('v1 compatibility baseline', () => {
  it('locks the package, binary, command, schema-version, and error-code surface', async () => {
    const surface = await readFixture<CompatibilitySurface>('surface.json')
    const packageJson = await readPackageManifest()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      setCliContext({
        interactive: false,
        outputMode: 'human',
        runId: 'v1-compatibility-surface',
      })

      const result = await commandsCommand()

      expect(packageJson.name).toBe(surface.packageName)
      expect(Object.keys(packageJson.bin).sort()).toEqual(surface.binaryNames)
      expect(cliErrorCodes).toEqual(surface.errorCodes)
      expect(result.meta.schemaVersion).toBe(surface.schemaVersion)
      expect(result.data?.commands.map(command => command.name)).toEqual(surface.commands)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('locks the maintained root-package runtime exports', async () => {
    const rootExports = await readFixture<string[]>('root-exports.json')

    expect(Object.keys(await import('../../src/index')).sort()).toEqual(rootExports)
  })

  it('loads valid and ghost v1 state without changing its meaning', async () => {
    const validFixture = await installStateFixture('valid.json')
    expect(await loadState()).toEqual(validFixture)

    const ghostFixture = await installStateFixture('ghost.json')
    const ghostState = await loadState()

    expect(ghostState).toEqual(ghostFixture)
    expect(ghostState.installedAgents.codex).toBeDefined()
  })

  it('represents an untracked agent by its absence from v1 state', async () => {
    const untrackedFixture = await installStateFixture('untracked.json')
    const state = await loadState()

    expect(state).toEqual(untrackedFixture)
    expect(state.installedAgents.codex).toBeUndefined()
  })

  it('keeps corrupt v1 state fail-closed with STATE_READ_ERROR behavior', async () => {
    await installStateFixtureText('corrupt.txt')

    await expect(loadState()).rejects.toBeInstanceOf(StateFileError)

    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'v1-compatibility-corrupt-state',
    })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const result = await executeCommandWithRuntime({
        action: 'compatibility-state',
        run: async () => {
          await loadState()
          throw new Error('Expected corrupt state to fail before this point.')
        },
        target: {
          kind: 'system',
          name: 'state',
        },
      })

      expect(result.error?.code).toBe('STATE_READ_ERROR')
      expect(getExitCodeForResult(result)).toBe(12)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('locks list and info to strict v1 projections at the observation route boundary', async () => {
    const spies = installObservationRouteSpies()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      setCliContext({ interactive: false, outputMode: 'json', runId: 'v1-list-info-json' })
      await listCommand()
      await infoCommand('ta')

      const [listPayload, infoPayload] = logSpy.mock.calls.map(call => JSON.parse(call[0]))
      expect(listPayload).toEqual(expectedListResult('json', 'v1-list-info-json'))
      expect(infoPayload).toEqual(expectedInfoResult('json', 'v1-list-info-json'))
      expectNoInternalObservationFields(listPayload)
      expectNoInternalObservationFields(infoPayload)
      expectRouteSpies(spies)
    } finally {
      logSpy.mockRestore()
      restoreRouteSpies(spies)
    }
  })

  it('locks list and info NDJSON result events to strict v1 projections', async () => {
    const spies = installObservationRouteSpies()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      setCliContext({ interactive: false, outputMode: 'ndjson', runId: 'v1-list-info-ndjson' })
      await listCommand()
      await infoCommand('ta')

      const [listEvent, infoEvent] = logSpy.mock.calls.map(call => JSON.parse(call[0]))
      expect(listEvent).toEqual(
        expectedResultEvent(
          expectedListResult('ndjson', 'v1-list-info-ndjson'),
          { kind: 'system', name: 'agents' },
          'v1-list-info-ndjson',
        ),
      )
      expect(infoEvent).toEqual(
        expectedResultEvent(
          expectedInfoResult('ndjson', 'v1-list-info-ndjson'),
          { kind: 'agent', name: 'test-agent' },
          'v1-list-info-ndjson',
        ),
      )
      expectNoInternalObservationFields(listEvent)
      expectNoInternalObservationFields(infoEvent)
      expectRouteSpies(spies)
    } finally {
      logSpy.mockRestore()
      restoreRouteSpies(spies)
    }
  })

  it('locks inspect and resolve JSON results to strict v1 observation projections', async () => {
    const observation = v1Observation()
    const spies = installInspectResolveRouteSpies(
      observation,
      observation,
      v1MissingObservation(),
      undefined,
      undefined,
    )
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      setCliContext({ interactive: false, outputMode: 'json', runId: 'v1-inspect-resolve-json' })
      await inspectCommand('ta')
      await resolveCommand('ta')
      await resolveCommand('ta')
      await inspectCommand('unknown')
      await resolveCommand('unknown')

      const [inspectPayload, resolvePayload, guidancePayload, inspectUnknownPayload, resolveUnknownPayload] =
        logSpy.mock.calls.map(call => JSON.parse(call[0]))
      expect(inspectPayload).toEqual(expectedInspectResult('json', 'v1-inspect-resolve-json'))
      expect(resolvePayload).toEqual(expectedResolveResult('json', 'v1-inspect-resolve-json'))
      expect(guidancePayload).toEqual(expectedResolveGuidanceResult('json', 'v1-inspect-resolve-json'))
      expect(inspectUnknownPayload).toEqual(expectedAgentNotFoundResult('inspect', 'json', 'v1-inspect-resolve-json'))
      expect(resolveUnknownPayload).toEqual(expectedAgentNotFoundResult('resolve', 'json', 'v1-inspect-resolve-json'))
      expectNoInspectInternalObservationFields(inspectPayload)
      expectNoInternalObservationFields(resolvePayload)
      expectNoInternalObservationFields(guidancePayload)
      expectNoInternalObservationFields(inspectUnknownPayload)
      expectNoInternalObservationFields(resolveUnknownPayload)
      expectInspectResolveRouteSpies(spies, ['ta', 'ta', 'ta', 'unknown', 'unknown'])
    } finally {
      logSpy.mockRestore()
      restoreInspectResolveRouteSpies(spies)
    }
  })

  it('locks inspect and resolve NDJSON result events to strict v1 observation projections', async () => {
    const observation = v1Observation()
    const spies = installInspectResolveRouteSpies(
      observation,
      observation,
      undefined,
      undefined,
      v1MissingObservation(),
    )
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      setCliContext({ interactive: false, outputMode: 'ndjson', runId: 'v1-inspect-resolve-ndjson' })
      await inspectCommand('ta')
      await resolveCommand('ta')
      await inspectCommand('unknown')
      await resolveCommand('unknown')
      await resolveCommand('ta')

      const [inspectEvent, resolveEvent, inspectUnknownEvent, resolveUnknownEvent, guidanceEvent] =
        logSpy.mock.calls.map(call => JSON.parse(call[0]))
      expect(inspectEvent).toEqual(
        expectedResultEvent(
          expectedInspectResult('ndjson', 'v1-inspect-resolve-ndjson'),
          { kind: 'agent', name: 'test-agent' },
          'v1-inspect-resolve-ndjson',
        ),
      )
      expect(resolveEvent).toEqual(
        expectedResultEvent(
          expectedResolveResult('ndjson', 'v1-inspect-resolve-ndjson'),
          { kind: 'agent', name: 'test-agent' },
          'v1-inspect-resolve-ndjson',
        ),
      )
      expect(inspectUnknownEvent).toEqual(
        expectedResultEvent(
          expectedAgentNotFoundResult('inspect', 'ndjson', 'v1-inspect-resolve-ndjson'),
          { kind: 'agent', name: 'unknown' },
          'v1-inspect-resolve-ndjson',
        ),
      )
      expect(resolveUnknownEvent).toEqual(
        expectedResultEvent(
          expectedAgentNotFoundResult('resolve', 'ndjson', 'v1-inspect-resolve-ndjson'),
          { kind: 'agent', name: 'unknown' },
          'v1-inspect-resolve-ndjson',
        ),
      )
      expect(guidanceEvent).toEqual(
        expectedResultEvent(
          expectedResolveGuidanceResult('ndjson', 'v1-inspect-resolve-ndjson'),
          { kind: 'agent', name: 'test-agent' },
          'v1-inspect-resolve-ndjson',
        ),
      )
      expectNoInspectInternalObservationFields(inspectEvent)
      expectNoInternalObservationFields(resolveEvent)
      expectNoInternalObservationFields(inspectUnknownEvent)
      expectNoInternalObservationFields(resolveUnknownEvent)
      expectNoInternalObservationFields(guidanceEvent)
      expectInspectResolveRouteSpies(spies, ['ta', 'ta', 'unknown', 'unknown', 'ta'])
    } finally {
      logSpy.mockRestore()
      restoreInspectResolveRouteSpies(spies)
    }
  })
})

function installInspectResolveRouteSpies(
  ...observations: Array<Awaited<ReturnType<typeof lifecycleObservations.resolveAgentObservation>>>
) {
  const queue = [...observations]
  return {
    legacy: vi
      .spyOn(legacyAgentsService, 'resolveAgentInspection')
      .mockRejectedValue(new Error('legacy inspect/resolve inspection must not run')),
    resolve: vi.spyOn(lifecycleObservations, 'resolveAgentObservation').mockImplementation(async () => queue.shift()),
  }
}

function restoreInspectResolveRouteSpies(spies: ReturnType<typeof installInspectResolveRouteSpies>): void {
  spies.legacy.mockRestore()
  spies.resolve.mockRestore()
}

function expectInspectResolveRouteSpies(
  spies: ReturnType<typeof installInspectResolveRouteSpies>,
  inputs: string[],
): void {
  expect(spies.resolve.mock.calls.map(([input]) => input)).toEqual(inputs)
  expect(spies.legacy).not.toHaveBeenCalled()
}

function installObservationRouteSpies() {
  const observation = v1Observation()
  return {
    legacyInfo: vi
      .spyOn(legacyAgentsService, 'resolveAgentInspection')
      .mockRejectedValueOnce(new Error('legacy info inspection must not run')),
    legacyList: vi
      .spyOn(legacyAgentsService, 'inspectRegisteredAgents')
      .mockRejectedValueOnce(new Error('legacy list inspection must not run')),
    observe: vi.spyOn(lifecycleObservations, 'observeRegisteredAgents').mockResolvedValueOnce([observation]),
    resolve: vi.spyOn(lifecycleObservations, 'resolveAgentObservation').mockResolvedValueOnce(observation),
  }
}

function restoreRouteSpies(spies: ReturnType<typeof installObservationRouteSpies>): void {
  spies.legacyInfo.mockRestore()
  spies.legacyList.mockRestore()
  spies.resolve.mockRestore()
  spies.observe.mockRestore()
}

function expectRouteSpies(spies: ReturnType<typeof installObservationRouteSpies>): void {
  expect(spies.observe).toHaveBeenCalledOnce()
  expect(spies.resolve).toHaveBeenCalledWith('ta')
  expect(spies.legacyList).not.toHaveBeenCalled()
  expect(spies.legacyInfo).not.toHaveBeenCalled()
}

function v1Observation() {
  const agent = {
    binaryName: 'test-bin',
    displayName: 'Test Agent',
    homepage: 'https://example.com',
    lookupAliases: ['ta'],
    name: 'test-agent',
    packages: { npm: 'test-pkg' },
    platforms: { linux: [{ packageName: 'test-pkg', type: 'bun' as const }] },
    selfUpdate: { command: ['test-bin', 'update'] },
  }
  return {
    agent,
    capabilities: ['observe', 'update'] as const,
    catalogMethods: [],
    executable: { path: '/usr/bin/test-bin', present: true as const, version: '1.2.3' },
    installedState: { agentName: 'test-agent', installType: 'bun' as const, packageName: 'test-pkg' },
    latestVersion: '2.0.0',
    methods: [{ packageName: 'test-pkg', type: 'bun' as const }],
    observation: {
      drift: { kind: 'none' as const },
      executablePath: '/usr/bin/test-bin',
      kind: 'present' as const,
      targetId: 'test-agent',
      version: '1.2.3',
    },
    pathExecutable: { path: '/usr/bin/test-bin', present: true as const, version: '1.2.3' },
    receipt: {
      kind: 'lifecycle-receipt' as const,
      providerId: 'bun' as const,
      providerTargetId: 'test-pkg',
      providerTargetKind: 'package' as const,
      schemaVersion: 1 as const,
      targetId: 'test-agent',
      verifiedAt: '2026-07-12T08:00:00.000Z',
    },
    resolvedBinaryPath: '/usr/bin/test-bin',
  }
}

function v1MissingObservation() {
  return {
    ...v1Observation(),
    executable: { present: false as const },
    observation: {
      drift: { kind: 'recorded-absent' as const },
      kind: 'absent' as const,
      targetId: 'test-agent',
    },
    pathExecutable: { present: false as const },
    resolvedBinaryPath: undefined,
  }
}

function expectedListResult(mode: 'json' | 'ndjson', runId: string) {
  return {
    action: 'list',
    data: {
      agents: [
        {
          binaryName: 'test-bin',
          displayName: 'Test Agent',
          installed: true,
          installedVersion: '1.2.3',
          latestVersion: '2.0.0',
          lifecycle: 'managed',
          name: 'test-agent',
          sourceLabel: 'managed via bun (test-pkg)',
          updateLabel: 'managed update',
        },
      ],
    },
    error: null,
    meta: expectedMeta(mode, runId),
    ok: true,
    target: { kind: 'system', name: 'agents' },
    warnings: [],
  }
}

function expectedInfoResult(mode: 'json' | 'ndjson', runId: string) {
  return {
    action: 'info',
    data: {
      agent: {
        aliases: ['ta'],
        binaryName: 'test-bin',
        displayName: 'Test Agent',
        installMethods: [{ command: 'bun add -g test-pkg', label: 'managed/bun (test-pkg)', type: 'bun' }],
        name: 'test-agent',
        packageName: 'test-pkg',
        selfUpdateCommands: ['test-bin update'],
      },
      inspection: {
        binaryPath: '/usr/bin/test-bin',
        installed: true,
        installedVersion: '1.2.3',
        latestVersion: '2.0.0',
        lifecycle: 'managed',
        sourceLabel: 'managed via bun (test-pkg)',
      },
    },
    error: null,
    meta: expectedMeta(mode, runId),
    ok: true,
    target: { kind: 'agent', name: 'test-agent' },
    warnings: [],
  }
}

function expectedInspectResult(mode: 'json' | 'ndjson', runId: string) {
  return {
    action: 'inspect',
    data: {
      agent: {
        aliases: ['ta'],
        binaryName: 'test-bin',
        displayName: 'Test Agent',
        installMethods: [{ command: 'bun add -g test-pkg', label: 'managed/bun (test-pkg)', type: 'bun' }],
        name: 'test-agent',
        packageName: 'test-pkg',
        selfUpdateCommands: ['test-bin update'],
      },
      capabilities: {
        canAutoInstall: true,
        canAutoUninstall: true,
        canRun: true,
        canSelfUpdate: true,
      },
      inspection: {
        binaryPath: '/usr/bin/test-bin',
        installed: true,
        installedVersion: '1.2.3',
        latestVersion: '2.0.0',
        lifecycle: 'managed',
        sourceLabel: 'managed via bun (test-pkg)',
        updateLabel: 'managed update',
      },
    },
    error: null,
    meta: expectedMeta(mode, runId),
    ok: true,
    target: { kind: 'agent', name: 'test-agent' },
    warnings: [],
  }
}

function expectedResolveResult(mode: 'json' | 'ndjson', runId: string) {
  return {
    action: 'resolve',
    data: {
      agent: { binaryName: 'test-bin', displayName: 'Test Agent', name: 'test-agent' },
      resolution: {
        binaryPath: '/usr/bin/test-bin',
        installed: true,
        installSource: 'bun',
        installedVersion: '1.2.3',
        lifecycle: 'managed',
        sourceLabel: 'managed via bun (test-pkg)',
        suggestedLaunchCommand: ['/usr/bin/test-bin'],
      },
    },
    error: null,
    meta: expectedMeta(mode, runId),
    ok: true,
    target: { kind: 'agent', name: 'test-agent' },
    warnings: [],
  }
}

function expectedResolveGuidanceResult(mode: 'json' | 'ndjson', runId: string) {
  const installGuidance = {
    docsRef: 'skills/quantex-cli/references/command-recipes.md',
    installMethods: [{ command: 'bun add -g test-pkg', label: 'managed/bun (test-pkg)', type: 'bun' }],
    suggestedAction: 'ensure-agent-installed',
    suggestedEnsureCommand: 'quantex ensure test-agent',
  }
  return {
    action: 'resolve',
    data: {
      agent: { binaryName: 'test-bin', displayName: 'Test Agent', name: 'test-agent' },
      resolution: {
        binaryPath: '',
        installGuidance,
        installed: false,
        installSource: 'not-installed',
        lifecycle: 'unmanaged',
        sourceLabel: 'not installed',
        suggestedLaunchCommand: [],
      },
    },
    error: {
      code: 'AGENT_NOT_INSTALLED',
      details: installGuidance,
      message: 'Test Agent is not installed.',
    },
    meta: expectedMeta(mode, runId),
    ok: false,
    target: { kind: 'agent', name: 'test-agent' },
    warnings: [],
  }
}

function expectedAgentNotFoundResult(action: 'inspect' | 'resolve', mode: 'json' | 'ndjson', runId: string) {
  return {
    action,
    error: {
      code: 'AGENT_NOT_FOUND',
      details: { input: 'unknown' },
      message: 'Unknown agent: unknown',
    },
    meta: expectedMeta(mode, runId),
    ok: false,
    target: { kind: 'agent', name: 'unknown' },
    warnings: [],
  }
}

function expectedResultEvent(
  result:
    | ReturnType<typeof expectedListResult>
    | ReturnType<typeof expectedInfoResult>
    | ReturnType<typeof expectedInspectResult>
    | ReturnType<typeof expectedResolveResult>
    | ReturnType<typeof expectedResolveGuidanceResult>
    | ReturnType<typeof expectedAgentNotFoundResult>,
  target: { kind: string; name: string },
  runId: string,
) {
  return {
    action: result.action,
    data: result,
    meta: expectedMeta('ndjson', runId),
    target,
    type: 'result',
  }
}

function expectedMeta(mode: 'json' | 'ndjson', runId: string) {
  return {
    mode,
    runId,
    schemaVersion: '1',
    timestamp: expect.any(String),
    version: expect.any(String),
  }
}

function expectNoInternalObservationFields(value: unknown): void {
  expect(JSON.stringify(value)).not.toMatch(
    /"(?:binding|capabilities|drift|providerTarget|providerTargetId|providerTargetKind|receipt)"/,
  )
}

function expectNoInspectInternalObservationFields(value: unknown): void {
  expect(JSON.stringify(value)).not.toMatch(
    /"(?:binding|drift|providerTarget|providerTargetId|providerTargetKind|receipt)"/,
  )
  expect(JSON.stringify(value)).not.toMatch(/"capabilities":\[/)
}

async function readFixture<T>(fixturePath: string): Promise<T> {
  return JSON.parse(await readFixtureText(fixturePath)) as T
}

async function readFixtureText(fixturePath: string): Promise<string> {
  return readFile(new URL(`../fixtures/compatibility/v1/${fixturePath}`, import.meta.url), 'utf8')
}

async function readPackageManifest(): Promise<PackageManifest> {
  return JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as PackageManifest
}

async function installStateFixture(fixtureName: string): Promise<QuantexState> {
  const fixture = await readFixture<QuantexState>(`state/${fixtureName}`)
  await writeFile(join(tempHome, '.quantex', 'state.json'), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8')
  return fixture
}

async function installStateFixtureText(fixtureName: string): Promise<void> {
  await writeFile(join(tempHome, '.quantex', 'state.json'), await readFixtureText(`state/${fixtureName}`), 'utf8')
}
