import type { AgentDefinition, InstallMethod } from '../../src/agents/types'
import type { CoreInstallationExecutionOutcome } from '../../src/core/installation-executor'
import type { CoreInvocationOutcome } from '../../src/core/invocation'
import type { CoreMutationRecipeCatalog } from '../../src/core/mutation-recipe-catalog'
import type { CoreAgentObservation } from '../../src/core/production-observation'
import type { LifecycleReceipt } from '../../src/lifecycle/model'
import type {
  ProviderAdapter,
  ProviderMutationEvidence,
  ProviderOutcome,
  ProviderTarget,
} from '../../src/providers/types'
import type { InstalledAgentState, VersionedQuantexState } from '../../src/state/schema'
import { describe, expect, it, vi } from 'vitest'

/**
 * Core-only install/ensure compatibility gate.
 *
 * CLI install/ensure no longer expose a live legacy engine route, so this file
 * stops dual-engine live comparison. It runs the Core executor once per scenario
 * and asserts decision / typed outcome / state effects / CLI projection against
 * frozen Core-side expected payloads (aligned with `core-installation-cli` tests).
 * Free-form diagnostic reason/remediation text stays incomparable.
 */

type Operation = 'ensure' | 'install'

type ScenarioName =
  | 'binary-verification-failure'
  | 'conflict'
  | 'external-adopted'
  | 'external-preserved'
  | 'indeterminate'
  | 'managed-no-op'
  | 'missing-success'
  | 'provider-cancelled'
  | 'provider-timeout'
  | 'script-verification-failure'
  | 'stale-exact-reinstall'
  | 'verification-failure'

interface DifferentialScenario {
  readonly initial: 'conflict' | 'external' | 'indeterminate' | 'managed' | 'missing' | 'stale'
  readonly mutation: 'cancelled' | 'success' | 'timed-out'
  readonly name: ScenarioName
  readonly source: 'binary' | 'npm' | 'script'
  readonly verification: 'satisfied' | 'unsatisfied'
}

interface MutableWorld {
  artifactPresent: boolean
  readonly agent: AgentDefinition
  readonly events: string[]
  readonly id: string
  installedByEngine: boolean
  readonly initialDocument: VersionedQuantexState
  readonly initialObservation: CoreAgentObservation
  readonly method: InstallMethod
  readonly mutation: DifferentialScenario['mutation']
  readonly operation: Operation
  readonly recipeState: InstalledAgentState
  recordWrites: number
  readonly scenario: DifferentialScenario
  readonly source: DifferentialScenario['source']
  state: VersionedQuantexState
  readonly verification: DifferentialScenario['verification']
}

type WorldWithoutInitialObservation = Omit<MutableWorld, 'initialObservation'>

const AGENT: AgentDefinition = {
  binaryName: 'fixture-agent',
  displayName: 'Fixture Agent',
  homepage: 'https://example.com/fixture-agent',
  name: 'fixture-agent',
  packages: { npm: 'fixture-agent' },
  platforms: {
    linux: [
      { packageName: 'fixture-agent', type: 'npm' },
      { command: 'curl -fsSL https://example.com/fixture-agent | sh', type: 'script' },
      { command: 'fixture-installer --install fixture-agent', type: 'binary' },
    ],
  },
}

vi.mock('../../src/cli-context', () => ({
  getCliContext: () => ({
    cacheMode: 'default',
    cancelled: false,
    colorMode: 'never',
    interactive: false,
    logLevel: 'silent',
    outputMode: 'human',
    quiet: true,
    runId: 'core-installation-differential',
  }),
}))
vi.mock('../../src/services/agents', () => ({
  resolveAgent: () => AGENT,
}))
vi.mock('../../src/output', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/output')>()
  return {
    ...actual,
    emitCommandEvent: () => undefined,
    emitCommandResult: <T>(result: T) => result,
  }
})
vi.mock('../../src/utils/user-output', () => ({
  isDryRunEnabled: () => false,
  printError: vi.fn(),
  printInfo: vi.fn(),
  printWarn: vi.fn(),
}))

import type { CommandResult } from '../../src/output/types'
import { projectCoreInstallationOutcome } from '../../src/commands/core-installation-cli'
import { decideCoreInstallation } from '../../src/core/installation-decision'
import { executeCoreInstallation } from '../../src/core/installation-executor'
import { createProductionCoreInstallationPorts } from '../../src/core/installation-production'
import { runCoreInvocation } from '../../src/core/invocation'
import { getExitCodeForResult } from '../../src/errors'
import {
  resolveInstallMethodProviderBinding,
  resolveReceiptProviderBinding,
  resolveStateProviderBinding,
} from '../../src/lifecycle/provider-binding'
import { createProviderRegistry } from '../../src/providers/registry'
import { createEmptyStateDocument } from '../../src/state/schema'
import { LifecycleStateStore } from '../../src/state/store'

const CONFIG_DIR = '/isolated/quantex-config'
const SCRIPT_COMMAND = 'curl -fsSL https://example.com/fixture-agent | sh'
const BINARY_COMMAND = 'fixture-installer --install fixture-agent'
const OBSERVED_AT = '2026-07-23T00:00:00.000Z'
const VERIFIED_AT = '2026-07-23T00:00:01.000Z'

const SCENARIOS: readonly DifferentialScenario[] = [
  {
    initial: 'missing',
    mutation: 'success',
    name: 'missing-success',
    source: 'npm',
    verification: 'satisfied',
  },
  {
    initial: 'managed',
    mutation: 'success',
    name: 'managed-no-op',
    source: 'npm',
    verification: 'satisfied',
  },
  {
    initial: 'external',
    mutation: 'success',
    name: 'external-preserved',
    source: 'npm',
    verification: 'satisfied',
  },
  {
    initial: 'external',
    mutation: 'success',
    name: 'external-adopted',
    source: 'script',
    verification: 'satisfied',
  },
  {
    initial: 'stale',
    mutation: 'success',
    name: 'stale-exact-reinstall',
    source: 'npm',
    verification: 'satisfied',
  },
  {
    initial: 'conflict',
    mutation: 'success',
    name: 'conflict',
    source: 'npm',
    verification: 'satisfied',
  },
  {
    initial: 'indeterminate',
    mutation: 'success',
    name: 'indeterminate',
    source: 'npm',
    verification: 'satisfied',
  },
  {
    initial: 'missing',
    mutation: 'timed-out',
    name: 'provider-timeout',
    source: 'npm',
    verification: 'satisfied',
  },
  {
    initial: 'missing',
    mutation: 'cancelled',
    name: 'provider-cancelled',
    source: 'npm',
    verification: 'satisfied',
  },
  {
    initial: 'missing',
    mutation: 'success',
    name: 'verification-failure',
    source: 'npm',
    verification: 'unsatisfied',
  },
  {
    initial: 'missing',
    mutation: 'success',
    name: 'script-verification-failure',
    source: 'script',
    verification: 'unsatisfied',
  },
  {
    initial: 'missing',
    mutation: 'success',
    name: 'binary-verification-failure',
    source: 'binary',
    verification: 'unsatisfied',
  },
]

type CanonicalDecision =
  | 'already-satisfied'
  | 'blocked-conflict'
  | 'blocked-indeterminate'
  | 'external-preserved'
  | 'install'
  | 'reinstall'

type CommonTypedOutcome =
  | { readonly changed: boolean; readonly kind: 'success' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'timed-out' }
  | {
      readonly code: 'decision-conflict' | 'decision-indeterminate' | 'verification-failed'
      readonly kind: 'failure'
    }

interface ExpectedScenario {
  readonly artifactPresent: boolean
  readonly decision: CanonicalDecision
  readonly diagnostics?: { readonly phase?: string; readonly sideEffect?: string }
  readonly hasReceipt: boolean
  readonly recordWrites: number
  readonly typedOutcome: CommonTypedOutcome
  readonly warningCodes: readonly string[]
  readonly cli: {
    readonly error: null | {
      readonly code: string
      readonly details?: Record<string, unknown>
      readonly message: string
    }
    readonly ok: boolean
  }
}

/**
 * Frozen Core-side expectations for the CLI projector. Verification failures keep
 * Core's `lifecycle: verification-failed` marker (locked by core-installation-cli);
 * free-form reason/remediation remain stripped before comparison.
 */
const EXPECTED: Record<ScenarioName, ExpectedScenario> = {
  'missing-success': {
    artifactPresent: true,
    cli: { error: null, ok: true },
    decision: 'install',
    hasReceipt: true,
    recordWrites: 1,
    typedOutcome: { changed: true, kind: 'success' },
    warningCodes: [],
  },
  'managed-no-op': {
    artifactPresent: true,
    cli: { error: null, ok: true },
    decision: 'already-satisfied',
    hasReceipt: true,
    recordWrites: 0,
    typedOutcome: { changed: false, kind: 'success' },
    warningCodes: ['ALREADY_INSTALLED'],
  },
  'external-preserved': {
    artifactPresent: true,
    cli: { error: null, ok: true },
    decision: 'external-preserved',
    hasReceipt: false,
    recordWrites: 0,
    typedOutcome: { changed: false, kind: 'success' },
    warningCodes: ['UNTRACKED_EXISTING_INSTALL'],
  },
  'external-adopted': {
    artifactPresent: true,
    cli: { error: null, ok: true },
    decision: 'external-preserved',
    hasReceipt: true,
    recordWrites: 1,
    typedOutcome: { changed: true, kind: 'success' },
    warningCodes: ['TRACKED_EXISTING_INSTALL'],
  },
  'stale-exact-reinstall': {
    artifactPresent: true,
    cli: { error: null, ok: true },
    decision: 'reinstall',
    hasReceipt: true,
    recordWrites: 1,
    typedOutcome: { changed: true, kind: 'success' },
    warningCodes: [],
  },
  conflict: {
    artifactPresent: true,
    cli: {
      error: {
        code: 'INSTALL_FAILED',
        details: { lifecycle: 'decision-indeterminate' },
        message: 'Quantex could not determine the installed state of Fixture Agent.',
      },
      ok: false,
    },
    decision: 'blocked-conflict',
    diagnostics: { phase: 'decide', sideEffect: 'none' },
    hasReceipt: true,
    recordWrites: 0,
    typedOutcome: { code: 'decision-conflict', kind: 'failure' },
    warningCodes: [],
  },
  indeterminate: {
    artifactPresent: false,
    cli: {
      error: {
        code: 'INSTALL_FAILED',
        details: { lifecycle: 'decision-indeterminate' },
        message: 'Quantex could not determine the installed state of Fixture Agent.',
      },
      ok: false,
    },
    decision: 'blocked-indeterminate',
    diagnostics: { phase: 'decide', sideEffect: 'none' },
    hasReceipt: false,
    recordWrites: 0,
    typedOutcome: { code: 'decision-indeterminate', kind: 'failure' },
    warningCodes: [],
  },
  'provider-timeout': {
    artifactPresent: false,
    cli: {
      error: { code: 'INSTALL_FAILED', message: 'Failed to install Fixture Agent.' },
      ok: false,
    },
    decision: 'install',
    diagnostics: { phase: 'execute', sideEffect: 'may-remain' },
    hasReceipt: false,
    recordWrites: 0,
    typedOutcome: { kind: 'timed-out' },
    warningCodes: [],
  },
  'provider-cancelled': {
    artifactPresent: false,
    cli: {
      error: {
        code: 'CANCELLED',
        message: 'Install was cancelled before tracking could complete.',
      },
      ok: false,
    },
    decision: 'install',
    diagnostics: { phase: 'execute', sideEffect: 'may-remain' },
    hasReceipt: false,
    recordWrites: 0,
    typedOutcome: { kind: 'cancelled' },
    warningCodes: [],
  },
  'verification-failure': {
    artifactPresent: false,
    cli: {
      error: {
        code: 'INSTALL_FAILED',
        details: { lifecycle: 'verification-failed' },
        message: 'Fixture Agent could not be verified after installation.',
      },
      ok: false,
    },
    decision: 'install',
    diagnostics: { phase: 'verify', sideEffect: 'compensated' },
    hasReceipt: false,
    recordWrites: 0,
    typedOutcome: { code: 'verification-failed', kind: 'failure' },
    warningCodes: [],
  },
  'script-verification-failure': {
    artifactPresent: true,
    cli: {
      error: {
        code: 'INSTALL_FAILED',
        details: { lifecycle: 'verification-failed' },
        message: 'Fixture Agent could not be verified after installation.',
      },
      ok: false,
    },
    decision: 'install',
    diagnostics: { phase: 'verify', sideEffect: 'may-remain' },
    hasReceipt: false,
    recordWrites: 0,
    typedOutcome: { code: 'verification-failed', kind: 'failure' },
    warningCodes: [],
  },
  'binary-verification-failure': {
    artifactPresent: true,
    cli: {
      error: {
        code: 'INSTALL_FAILED',
        details: { lifecycle: 'verification-failed' },
        message: 'Fixture Agent could not be verified after installation.',
      },
      ok: false,
    },
    decision: 'install',
    diagnostics: { phase: 'verify', sideEffect: 'may-remain' },
    hasReceipt: false,
    recordWrites: 0,
    typedOutcome: { code: 'verification-failed', kind: 'failure' },
    warningCodes: [],
  },
}

describe.each(['install', 'ensure'] as const)('Core %s compatibility gate', operation => {
  it.each(SCENARIOS)('$name matches frozen Core CLI / engine expectations', async scenario => {
    const core = await runCore(operation, scenario)
    const expected = expectedFor(operation, scenario.name)

    expect(core.events.some(event => event.startsWith('legacy:'))).toBe(false)
    expect(core.decision).toEqual(expected.decision)
    expect(core.typedOutcome).toEqual(expected.typedOutcome)
    expect(core.recordWrites).toBe(expected.recordWrites)
    expect(core.artifactPresent).toBe(expected.artifactPresent)
    expect(core.receipt !== undefined).toBe(expected.hasReceipt)
    expect(core.diagnostics).toEqual(expected.diagnostics)
    expect(core.cli.ok).toBe(expected.cli.ok)
    expect(core.cli.action).toBe(operation)
    if (expected.cli.ok) expect(core.cli.exitCode).toBe(0)
    else expect(core.cli.exitCode).toBeGreaterThan(0)
    expect(core.cli.error).toEqual(expected.cli.error)
    expect(core.cli.warnings.map(warning => warningCode(warning))).toEqual([...expected.warningCodes])

    if (scenario.name === 'script-verification-failure' || scenario.name === 'binary-verification-failure') {
      // Script/binary compensation leaves the artifact and does not uninstall.
      expect(core.events).not.toContain('core:uninstall')
    }
    if (scenario.name === 'verification-failure') {
      expect(core.events).toContain('core:uninstall')
    }
  })
})

function expectedFor(operation: Operation, name: ScenarioName): ExpectedScenario {
  const base = EXPECTED[name]
  if (operation === 'install') return base

  const cliError = base.cli.error
  if (!cliError) return base

  if (cliError.code === 'CANCELLED') {
    return {
      ...base,
      cli: {
        ...base.cli,
        error: {
          ...cliError,
          message: 'Ensure was cancelled before tracking could complete.',
        },
      },
    }
  }

  if (cliError.details?.lifecycle === 'verification-failed') {
    return {
      ...base,
      cli: {
        ...base.cli,
        error: {
          ...cliError,
          message: 'Fixture Agent could not be verified after ensure completed.',
        },
      },
    }
  }

  return base
}

interface CoreSnapshot {
  readonly artifactPresent: boolean
  readonly cli: NormalizedCliProjection
  readonly decision: CanonicalDecision
  readonly diagnostics?: { readonly phase?: string; readonly sideEffect?: string }
  readonly events: readonly string[]
  readonly receipt?: NormalizedReceipt
  readonly recordWrites: number
  readonly typedOutcome: CommonTypedOutcome
}

interface NormalizedReceipt {
  readonly executableName?: string
  readonly executablePath?: string
  readonly kind: 'lifecycle-receipt'
  readonly providerId: string
  readonly providerTargetId: string
  readonly providerTargetKind?: string
  readonly schemaVersion: number
  readonly targetId: string
  readonly version?: string
}

interface NormalizedCliProjection {
  readonly action: string
  readonly data?: unknown
  readonly error: null | { readonly code: string; readonly details?: unknown; readonly message: string }
  readonly exitCode: number
  readonly ok: boolean
  readonly warnings: readonly unknown[]
}

async function runCore(operation: Operation, scenario: DifferentialScenario): Promise<CoreSnapshot> {
  const world = createWorld(operation, scenario)
  const registry = createProviderRegistry([createFakeProvider(world)])
  const persistence = {
    async load(): Promise<VersionedQuantexState> {
      return clone(world.state)
    },
    async save(document: VersionedQuantexState): Promise<void> {
      world.events.push('core:record')
      world.recordWrites += 1
      world.state = clone(document)
    },
  }
  const ports = createProductionCoreInstallationPorts({
    acquireResourceLock: async (_configDir, options) => {
      const scope = options.scope.join(',')
      world.events.push(`core:lock:${scope}:acquire`)
      return async () => {
        world.events.push(`core:lock:${scope}:release`)
      }
    },
    clock: () => VERIFIED_AT,
    configDir: CONFIG_DIR,
    platform: 'linux',
    providerRegistry: registry,
    readPorts: {
      async inspectAgent(): Promise<CoreAgentObservation> {
        world.events.push('core:observe')
        return buildObservation(world, world.installedByEngine ? VERIFIED_AT : OBSERVED_AT)
      },
      async listAgents() {
        return [AGENT]
      },
    },
    recipeCatalog: recipeCatalogFor(world),
    stateStore: new LifecycleStateStore(persistence),
  })

  const directive = decideCoreInstallation(world.initialObservation)
  const outcome = await runCoreInvocation(undefined, context =>
    executeCoreInstallation(
      { mode: 'apply', name: AGENT.name, operation },
      context,
      ports,
      scenario.name === 'external-adopted'
        ? {
            async resolveAdoption(before) {
              const binding = resolveInstallMethodProviderBinding(before.agent, world.method)
              if (!binding) throw new Error('The adoption fixture must resolve to a provider binding.')
              return { binding, installedState: clone(world.recipeState) }
            },
          }
        : {},
    ),
  )

  return {
    artifactPresent: world.artifactPresent,
    cli: normalizeCliResult(projectCoreInstallationOutcome(operation, AGENT.name, outcome)),
    decision: normalizeCoreDecision(directive),
    diagnostics: coreDiagnostics(outcome),
    events: [...world.events],
    receipt: normalizeReceipt(world.state.lifecycleReceipts[AGENT.name]),
    recordWrites: world.recordWrites,
    typedOutcome: normalizeCoreOutcome(outcome),
  }
}

function createWorld(operation: Operation, scenario: DifferentialScenario): MutableWorld {
  const method: InstallMethod =
    scenario.source === 'script' || scenario.source === 'binary'
      ? {
          command: scenario.source === 'script' ? SCRIPT_COMMAND : BINARY_COMMAND,
          type: scenario.source,
        }
      : { packageName: AGENT.packages?.npm, type: 'npm' }
  const recipeState: InstalledAgentState =
    scenario.source === 'script' || scenario.source === 'binary'
      ? {
          agentName: AGENT.name,
          command: scenario.source === 'script' ? SCRIPT_COMMAND : BINARY_COMMAND,
          installType: scenario.source,
        }
      : { agentName: AGENT.name, installType: 'npm', packageName: AGENT.packages?.npm }
  const document = createInitialDocument(scenario, recipeState)
  const artifactPresent =
    scenario.initial === 'external' || scenario.initial === 'managed' || scenario.initial === 'conflict'
  const world: WorldWithoutInitialObservation = {
    agent: AGENT,
    artifactPresent,
    events: [],
    id: `core:${operation}:${scenario.name}:${crypto.randomUUID()}`,
    initialDocument: clone(document),
    installedByEngine: false,
    method,
    mutation: scenario.mutation,
    operation,
    recipeState,
    recordWrites: 0,
    scenario,
    source: scenario.source,
    state: clone(document),
    verification: scenario.verification,
  }
  return { ...world, initialObservation: buildObservation(world, OBSERVED_AT) }
}

function createInitialDocument(
  scenario: DifferentialScenario,
  installedState: InstalledAgentState,
): VersionedQuantexState {
  const document = createEmptyStateDocument()
  if (scenario.initial !== 'managed' && scenario.initial !== 'stale' && scenario.initial !== 'conflict') {
    return document
  }

  const binding = resolveStateProviderBinding(AGENT, installedState)
  if (!binding) throw new Error('The differential installed state must resolve to a provider binding.')
  const receipt = receiptFor(
    scenario.initial === 'conflict'
      ? { providerId: 'bun', target: { id: binding.target.id, kind: binding.target.kind } }
      : binding,
    scenario.initial === 'stale' ? '0.9.0' : '1.0.0',
    scenario.initial === 'stale' ? '/old/fixture-agent' : `/isolated/bin/${AGENT.binaryName}`,
    OBSERVED_AT,
  )
  return {
    ...document,
    installedAgents: { [AGENT.name]: clone(installedState) },
    lifecycleReceipts: { [AGENT.name]: receipt },
  }
}

function buildObservation(world: WorldWithoutInitialObservation, observedAt: string): CoreAgentObservation {
  const installedState = world.state.installedAgents[AGENT.name]
  const receipt = world.state.lifecycleReceipts[AGENT.name]
  const stateBinding = installedState ? resolveStateProviderBinding(AGENT, installedState) : undefined
  const receiptBinding = receipt ? resolveReceiptProviderBinding(receipt) : undefined
  const catalogBinding = resolveInstallMethodProviderBinding(AGENT, world.method)
  if (!catalogBinding) throw new Error('The differential install method must resolve to a provider binding.')

  const executable = world.artifactPresent
    ? { path: `/isolated/bin/${AGENT.binaryName}`, present: true, version: '1.0.0' }
    : { present: false as const }
  const base = {
    agent: AGENT,
    catalogMethods: [catalogBinding],
    executable,
    installedState,
    methods: [world.method],
    pathExecutable: executable,
    persistedBinding: receiptBinding ?? stateBinding,
    receipt,
  }

  if (world.scenario.initial === 'conflict') {
    return {
      ...base,
      capabilities: [],
      observation: {
        drift: {
          kind: 'conflicting-source',
          observedProviderId: stateBinding?.providerId,
          recordedProviderId: receiptBinding?.providerId,
        },
        executablePath: executable.path,
        kind: 'present',
        observedAt,
        targetId: AGENT.name,
        version: executable.version,
      },
      resolvedBinaryPath: executable.path,
    }
  }

  if (world.scenario.initial === 'indeterminate') {
    return {
      ...base,
      capabilities: [],
      observation: {
        drift: { kind: 'indeterminate', reason: 'fixture provider evidence is unknown' },
        kind: 'indeterminate',
        observedAt,
        reason: 'fixture provider evidence is unknown',
        targetId: AGENT.name,
      },
    }
  }

  if (!executable.present) {
    return {
      ...base,
      capabilities: catalogBinding ? ['availability', 'install', 'observe', 'uninstall', 'verify'] : [],
      observation: {
        drift: installedState ? { kind: 'recorded-absent' } : { kind: 'none' },
        kind: 'absent',
        observedAt,
        targetId: AGENT.name,
      },
    }
  }

  const liveBinding = catalogBinding
  const managed = Boolean(installedState && receiptBinding)
  return {
    ...base,
    ...(liveBinding ? { binding: liveBinding } : {}),
    capabilities: liveBinding ? ['availability', 'install', 'observe', 'uninstall', 'verify'] : [],
    observation: {
      drift: { kind: managed ? 'none' : 'untracked' },
      executablePath: executable.path,
      kind: 'present',
      observedAt,
      ...(liveBinding
        ? {
            providerId: liveBinding.providerId,
            providerTargetId: liveBinding.target.id,
            providerTargetKind: liveBinding.target.kind,
          }
        : {}),
      targetId: AGENT.name,
      version: executable.version,
    },
    resolvedBinaryPath: executable.path,
  }
}

function createFakeProvider(world: MutableWorld): ProviderAdapter {
  return {
    async availability() {
      world.events.push('core:availability')
      return { kind: 'success', value: { executable: world.source } }
    },
    id: world.source,
    async install({ target }) {
      world.events.push('core:install')
      if (world.mutation === 'cancelled') return { kind: 'cancelled', reason: 'fixture-cancelled' }
      if (world.mutation === 'timed-out') return { kind: 'timed-out', timeoutMs: 37 }
      world.artifactPresent = true
      world.installedByEngine = true
      return successfulMutation(target)
    },
    async observe({ target }) {
      world.events.push('core:provider-observe')
      return {
        kind: 'success',
        value: world.artifactPresent
          ? {
              executablePath: `/isolated/bin/${AGENT.binaryName}`,
              kind: 'present',
              target,
              version: '1.0.0',
            }
          : { kind: 'absent', target },
      }
    },
    async uninstall({ target }) {
      world.events.push('core:uninstall')
      if (world.source === 'npm') world.artifactPresent = false
      return successfulMutation(target)
    },
    async verify() {
      world.events.push('core:verify')
      return world.verification === 'satisfied'
        ? { kind: 'success', value: { evidence: [], kind: 'satisfied' } }
        : {
            kind: 'success',
            value: { evidence: [], kind: 'unsatisfied', reason: `binary-not-found-after-${world.operation}` },
          }
    },
  }
}

function recipeCatalogFor(world: MutableWorld): CoreMutationRecipeCatalog {
  return [
    {
      name: AGENT.name,
      platforms: {
        linux: [
          world.source === 'script'
            ? {
                provider: 'script',
                target: {
                  effect: { command: SCRIPT_COMMAND, kind: 'shell-script' },
                  id: 'https://example.com/fixture-agent',
                  kind: 'script',
                },
              }
            : world.source === 'binary'
              ? {
                  provider: 'binary',
                  target: {
                    effect: {
                      command: ['fixture-installer', '--install', 'fixture-agent'],
                      kind: 'executable',
                    },
                    id: 'https://example.com/fixture-agent.tar.gz',
                    kind: 'binary',
                  },
                }
              : { provider: 'npm', target: { id: AGENT.packages!.npm!, kind: 'package' } },
        ],
      },
    },
  ]
}

function successfulMutation(target: ProviderTarget): ProviderOutcome<ProviderMutationEvidence> {
  return { kind: 'success', value: { evidence: [], target } }
}

function normalizeCoreDecision(directive: ReturnType<typeof decideCoreInstallation>): CanonicalDecision {
  if (directive.kind === 'blocked') {
    return directive.code === 'conflict' ? 'blocked-conflict' : 'blocked-indeterminate'
  }
  if (directive.kind === 'interrupted') return 'blocked-indeterminate'
  return directive.decision
}

function normalizeCoreOutcome(outcome: CoreInvocationOutcome<CoreInstallationExecutionOutcome>): CommonTypedOutcome {
  if (outcome.kind === 'failure') {
    if (outcome.error.code === 'cancelled') return { kind: 'cancelled' }
    if (outcome.error.code === 'timed-out') return { kind: 'timed-out' }
    throw new Error(`Unexpected Core invocation failure: ${outcome.error.code}`)
  }
  if (outcome.value.kind === 'success') {
    const changed = outcome.value.value.kind === 'apply' ? outcome.value.value.changed : outcome.value.value.wouldChange
    return { changed, kind: 'success' }
  }
  if (outcome.value.kind === 'agent-not-found') throw new Error('The differential fixture agent disappeared.')
  const code = outcome.value.error.code
  if (code === 'decision-conflict' || code === 'decision-indeterminate' || code === 'verification-failed') {
    return { code, kind: 'failure' }
  }
  throw new Error(`Unexpected Core execution failure: ${code}`)
}

function coreDiagnostics(
  outcome: CoreInvocationOutcome<CoreInstallationExecutionOutcome>,
): CoreSnapshot['diagnostics'] {
  if (outcome.kind === 'failure') {
    return {
      phase: typeof outcome.error.details?.phase === 'string' ? outcome.error.details.phase : undefined,
      sideEffect: typeof outcome.error.details?.sideEffect === 'string' ? outcome.error.details.sideEffect : undefined,
    }
  }
  return outcome.value.kind === 'failed'
    ? { phase: outcome.value.error.phase, sideEffect: outcome.value.error.sideEffect }
    : undefined
}

function normalizeReceipt(receipt: LifecycleReceipt | undefined): NormalizedReceipt | undefined {
  if (!receipt) return undefined
  return {
    ...(receipt.executableName === undefined ? {} : { executableName: receipt.executableName }),
    ...(receipt.executablePath === undefined ? {} : { executablePath: receipt.executablePath }),
    kind: 'lifecycle-receipt',
    providerId: receipt.providerId,
    providerTargetId: receipt.providerTargetId,
    ...(receipt.providerTargetKind === undefined ? {} : { providerTargetKind: receipt.providerTargetKind }),
    schemaVersion: receipt.schemaVersion,
    targetId: receipt.targetId,
    ...(receipt.version === undefined ? {} : { version: receipt.version }),
  }
}

function receiptFor(
  binding: {
    readonly providerId: string
    readonly target: { readonly id: string; readonly kind: NonNullable<LifecycleReceipt['providerTargetKind']> }
  },
  version: string,
  executablePath: string,
  verifiedAt: string,
): LifecycleReceipt {
  return {
    executablePath,
    kind: 'lifecycle-receipt',
    providerId: binding.providerId,
    providerTargetId: binding.target.id,
    providerTargetKind: binding.target.kind,
    schemaVersion: 1,
    targetId: AGENT.name,
    verifiedAt,
    version,
  }
}

function normalizeCliResult(result: CommandResult<unknown>): NormalizedCliProjection {
  return {
    action: result.action,
    ...(result.data === undefined ? {} : { data: clone(result.data) }),
    error: result.error
      ? {
          code: result.error.code,
          ...(result.error.details === undefined ? {} : { details: withoutDiagnosticReason(result.error.details) }),
          message: stripDiagnosticReason(result.error.message),
        }
      : null,
    exitCode: getExitCodeForResult(result),
    ok: result.ok,
    warnings: clone(result.warnings),
  }
}

/**
 * Free-form provider evidence stays out of the frozen contract. Core may attach
 * richer reason/remediation text than historical v1; the gate compares the stable
 * lifecycle marker and message family around it.
 */
function withoutDiagnosticReason(details: Record<string, unknown>): Record<string, unknown> {
  const { reason: _reason, remediation: _remediation, ...rest } = clone(details)
  return rest
}

function stripDiagnosticReason(message: string): string {
  const [head] = message.split(': ')
  return head === undefined || head === message ? message : `${head}.`
}

function warningCode(warning: unknown): string {
  if (warning && typeof warning === 'object' && 'code' in warning && typeof warning.code === 'string') {
    return warning.code
  }
  throw new Error('CLI warning is missing a stable code.')
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
