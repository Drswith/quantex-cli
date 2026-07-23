import type { AgentDefinition, InstallMethod } from '../../src/agents/types'
import type { CoreInstallationExecutionOutcome } from '../../src/core/installation-executor'
import type { CoreInvocationOutcome } from '../../src/core/invocation'
import type { CoreMutationRecipeCatalog } from '../../src/core/mutation-recipe-catalog'
import type { CoreAgentObservation } from '../../src/core/production-observation'
import type { LifecycleOutcome, LifecycleReceipt } from '../../src/lifecycle/model'
import type { LifecycleProviderBinding } from '../../src/lifecycle/provider-binding'
import type { VerifiedMutation } from '../../src/lifecycle/reconcile'
import type { CommandResult } from '../../src/output/types'
import type {
  ProviderAdapter,
  ProviderMutationEvidence,
  ProviderOutcome,
  ProviderTarget,
} from '../../src/providers/types'
import type { InstalledAgentState, VersionedQuantexState } from '../../src/state/schema'
import { describe, expect, it, vi } from 'vitest'

/**
 * Each runner owns one in-memory world and invokes exactly one mutation engine. The
 * legacy runner keeps the real command/reconciler and replaces only its hard-wired
 * effect ports; the Core runner keeps the executor/production composition/state
 * transaction and injects fake providers, reads, locks, and persistence.
 */
type Operation = 'ensure' | 'install'
type ScenarioName =
  | 'binary-verification-failure'
  | 'conflict'
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
  readonly engine: 'core' | 'legacy'
  readonly events: string[]
  readonly id: string
  installedByEngine: boolean
  readonly initialDocument: VersionedQuantexState
  readonly initialObservation: CoreAgentObservation
  legacyOutcome?: LifecycleOutcome<VerifiedMutation<{ installedState: InstalledAgentState }>>
  legacyRoute?: 'adopt' | 'install' | 'satisfied'
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

const legacyControl = vi.hoisted(() => {
  let active: MutableWorld | undefined

  const world = (): MutableWorld => {
    if (!active) throw new Error('The legacy differential world is not active.')
    return active
  }
  const executeInstall = async (): Promise<unknown> => {
    const current = world()
    current.events.push('legacy:install')
    if (current.mutation === 'cancelled') return { kind: 'cancelled', reason: 'fixture-cancelled' }
    if (current.mutation === 'timed-out') return { kind: 'timed-out', timeoutMs: 37 }
    current.artifactPresent = true
    current.installedByEngine = true
    return { kind: 'success', value: { installedState: structuredClone(current.recipeState) } }
  }

  return {
    activate(next: MutableWorld): void {
      if (active) throw new Error('A differential engine is already active.')
      active = next
    },
    async buildInstalledAgentState(): Promise<InstalledAgentState> {
      return structuredClone(world().recipeState)
    },
    captureLegacyOutcome(
      outcome: LifecycleOutcome<VerifiedMutation<{ installedState: InstalledAgentState }>>,
      route: MutableWorld['legacyRoute'],
    ): void {
      world().legacyOutcome = outcome
      world().legacyRoute = route
    },
    clear(): void {
      active = undefined
    },
    createCliOperationContext() {
      return {
        context: { signal: new AbortController().signal },
        dispose: vi.fn(),
        run: async <T>(run: () => Promise<T>): Promise<T> => run(),
      }
    },
    getCliContext() {
      return {
        cacheMode: 'default',
        cancelled: false,
        colorMode: 'never',
        interactive: false,
        logLevel: 'silent',
        outputMode: 'human',
        quiet: true,
        runId: 'core-installation-differential',
      }
    },
    async installAgentOutcome(): Promise<unknown> {
      return executeInstall()
    },
    async isBinaryInPath(): Promise<boolean> {
      const current = world()
      current.events.push('legacy:binary-probe')
      return current.artifactPresent && current.verification === 'satisfied'
    },
    async observeLifecycleProvider(binding: LifecycleProviderBinding): Promise<unknown> {
      const current = world()
      current.events.push('legacy:provider-observe')
      return {
        kind: 'success',
        value: current.artifactPresent
          ? {
              executablePath: `/isolated/bin/${current.agent.binaryName}`,
              kind: 'present',
              target: binding.target,
              version: '1.0.0',
            }
          : { kind: 'absent', target: binding.target },
      }
    },
    async reinstallInstalledAgentOutcome(): Promise<unknown> {
      world().events.push('legacy:reinstall')
      return executeInstall()
    },
    resolveAgent(): AgentDefinition {
      return world().agent
    },
    async resolveAgentObservation(): Promise<CoreAgentObservation> {
      const current = world()
      current.events.push('legacy:observe')
      return current.initialObservation
    },
    async rollbackInstalledAgentInstallation(): Promise<void> {
      const current = world()
      current.events.push('legacy:compensate')
      if (current.source === 'npm') current.artifactPresent = false
    },
    async setAgentLifecycleEvidence(installedState: InstalledAgentState, receipt: LifecycleReceipt): Promise<void> {
      const current = world()
      current.events.push('legacy:record')
      current.recordWrites += 1
      current.state = {
        ...current.state,
        installedAgents: {
          ...current.state.installedAgents,
          [installedState.agentName]: structuredClone(installedState),
        },
        lifecycleReceipts: {
          ...current.state.lifecycleReceipts,
          [receipt.targetId]: structuredClone(receipt),
        },
      }
    },
    async withAgentLifecycleLock<T>(run: () => Promise<T>): Promise<T> {
      const current = world()
      current.events.push('legacy:lock:acquire')
      try {
        return await run()
      } finally {
        current.events.push('legacy:lock:release')
      }
    },
  }
})

vi.mock('../../src/cli-context', () => ({ getCliContext: legacyControl.getCliContext }))
vi.mock('../../src/package-manager', () => ({
  buildInstalledAgentState: legacyControl.buildInstalledAgentState,
  installAgentOutcome: legacyControl.installAgentOutcome,
  reinstallInstalledAgentOutcome: legacyControl.reinstallInstalledAgentOutcome,
  rollbackInstalledAgentInstallation: legacyControl.rollbackInstalledAgentInstallation,
  withAgentLifecycleLock: legacyControl.withAgentLifecycleLock,
}))
vi.mock('../../src/runtime/cli-operation-context', () => ({
  createCliOperationContext: legacyControl.createCliOperationContext,
}))
vi.mock('../../src/services/agents', () => ({ resolveAgent: legacyControl.resolveAgent }))
vi.mock('../../src/services/lifecycle-observations', () => ({
  resolveAgentObservation: legacyControl.resolveAgentObservation,
}))
vi.mock('../../src/state', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/state')>()
  return { ...actual, setAgentLifecycleEvidence: legacyControl.setAgentLifecycleEvidence }
})
vi.mock('../../src/utils/detect', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/utils/detect')>()
  return { ...actual, isBinaryInPath: legacyControl.isBinaryInPath }
})
vi.mock('../../src/lifecycle/provider-evidence', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/lifecycle/provider-evidence')>()
  return { ...actual, observeLifecycleProvider: legacyControl.observeLifecycleProvider }
})
vi.mock('../../src/lifecycle', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/lifecycle')>()
  return {
    ...actual,
    async reconcileAgentInstallation(input: Parameters<typeof actual.reconcileAgentInstallation>[0]) {
      const outcome = await actual.reconcileAgentInstallation(input)
      legacyControl.captureLegacyOutcome(outcome, input.route)
      return outcome
    },
  }
})
vi.mock('../../src/output', () => ({
  createErrorResult: <T>(options: Record<string, unknown> & { data?: T; error: unknown }) => ({
    ...options,
    error: options.error,
    ok: false,
    warnings: options.warnings ?? [],
  }),
  createSuccessResult: <T>(options: Record<string, unknown> & { data?: T }) => ({
    ...options,
    error: null,
    ok: true,
    warnings: options.warnings ?? [],
  }),
  emitCommandEvent: () => undefined,
  emitCommandResult: <T>(result: T) => result,
}))
vi.mock('../../src/utils/user-output', () => ({
  isDryRunEnabled: () => false,
  printError: vi.fn(),
  printInfo: vi.fn(),
  printWarn: vi.fn(),
}))

import { ensureCommand } from '../../src/commands/ensure'
import { installCommand } from '../../src/commands/install'
import { decideCoreInstallation } from '../../src/core/installation-decision'
import { executeCoreInstallation } from '../../src/core/installation-executor'
import { createProductionCoreInstallationPorts } from '../../src/core/installation-production'
import { runCoreInvocation } from '../../src/core/invocation'
import {
  providerBindingsEqual,
  resolveInstallMethodProviderBinding,
  resolveReceiptProviderBinding,
  resolveStateProviderBinding,
} from '../../src/lifecycle/provider-binding'
import { createProviderRegistry } from '../../src/providers/registry'
import { createEmptyStateDocument } from '../../src/state/schema'
import { LifecycleStateStore } from '../../src/state/store'

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

describe.each(['install', 'ensure'] as const)('legacy/Core %s differential gate', operation => {
  it.each(SCENARIOS)('$name compares one isolated engine invocation at a time', async scenario => {
    const legacy = await runLegacy(operation, scenario)
    const core = await runCore(operation, scenario)

    expect(legacy.worldId).not.toBe(core.worldId)
    expect(legacy.selectedEngines).toEqual(['legacy'])
    expect(core.selectedEngines).toEqual(['core'])
    expect(legacy.events.some(event => event.startsWith('core:'))).toBe(false)
    expect(core.events.some(event => event.startsWith('legacy:'))).toBe(false)

    expect(core.observation).toEqual(legacy.observation)
    expect(core.decision).toEqual(legacy.decision)
    expect(core.typedOutcome).toEqual(legacy.typedOutcome)
    expect(core.stateDelta).toEqual(legacy.stateDelta)
    expect(core.receipt).toEqual(legacy.receipt)
    expect(core.cli).toEqual(legacy.cli)

    expect(legacy.incomparableFields).toEqual([
      'receipt.verifiedAt (engine-local clock)',
      'recordWrites (implementation-only; semantic state delta compared)',
      'typedOutcome.phase (not reported by v1)',
      'typedOutcome.sideEffect (not reported by v1)',
    ])
    expect(core.incomparableFields).toEqual(legacy.incomparableFields)

    if (
      scenario.name === 'verification-failure' ||
      scenario.name === 'script-verification-failure' ||
      scenario.name === 'binary-verification-failure'
    ) {
      expect(legacy.recordWrites).toBe(0)
      expect(core.recordWrites).toBe(0)
      expect(legacy.receipt).toBeUndefined()
      expect(core.receipt).toBeUndefined()
    }

    if (scenario.name === 'verification-failure') {
      expect(legacy.artifactPresent).toBe(false)
      expect(core.artifactPresent).toBe(false)
      expect(core.diagnostics).toEqual({ phase: 'verify', sideEffect: 'compensated' })
    }

    if (scenario.name === 'managed-no-op') {
      expect(legacy.recordWrites).toBe(1)
      expect(core.recordWrites).toBe(0)
      expect(core.stateDelta).toEqual(legacy.stateDelta)
    }

    if (scenario.name === 'script-verification-failure' || scenario.name === 'binary-verification-failure') {
      expect(legacy.artifactPresent).toBe(true)
      expect(core.artifactPresent).toBe(true)
      expect(legacy.events).toContain('legacy:compensate')
      expect(core.events).not.toContain('core:uninstall')
      expect(core.diagnostics).toEqual({ phase: 'verify', sideEffect: 'may-remain' })
    }
  })
})

interface DifferentialSnapshot {
  readonly artifactPresent: boolean
  readonly cli: NormalizedCliProjection
  readonly decision: CanonicalDecision
  readonly diagnostics?: { readonly phase?: string; readonly sideEffect?: string }
  readonly events: readonly string[]
  readonly incomparableFields: readonly string[]
  readonly observation: CanonicalObservation
  readonly receipt?: NormalizedReceipt
  readonly recordWrites: number
  readonly selectedEngines: readonly ('core' | 'legacy')[]
  readonly stateDelta: NormalizedStateDelta
  readonly typedOutcome: CommonTypedOutcome
  readonly worldId: string
}

type CanonicalDecision =
  | 'already-satisfied'
  | 'blocked-conflict'
  | 'blocked-indeterminate'
  | 'external-preserved'
  | 'install'
  | 'reinstall'

interface CanonicalObservation {
  readonly receipt?: NormalizedReceipt
  readonly source?: { readonly providerId: string; readonly targetId: string; readonly targetKind: string }
  readonly state?: InstalledAgentState
  readonly status: 'conflict' | 'external' | 'indeterminate' | 'managed' | 'missing' | 'stale'
}

type CommonTypedOutcome =
  | { readonly changed: boolean; readonly kind: 'success' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'timed-out' }
  | {
      readonly code: 'decision-conflict' | 'decision-indeterminate' | 'verification-failed'
      readonly kind: 'failure'
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

interface NormalizedStateDelta {
  readonly installedState: { readonly after?: InstalledAgentState; readonly before?: InstalledAgentState }
  readonly receipt: { readonly after?: NormalizedReceipt; readonly before?: NormalizedReceipt }
}

interface NormalizedCliProjection {
  readonly action: Operation
  readonly changed: boolean
  readonly error: null | { readonly code: string; readonly lifecycle?: string }
  readonly installed: boolean
  readonly installState?: { readonly installType: string; readonly packageName?: string }
  readonly ok: boolean
  readonly warningCodes: readonly string[]
}

async function runLegacy(operation: Operation, scenario: DifferentialScenario): Promise<DifferentialSnapshot> {
  const world = createWorld('legacy', operation, scenario)
  legacyControl.activate(world)
  let result: CommandResult<unknown>
  try {
    result =
      operation === 'install'
        ? ((await installCommand(AGENT.name)) as CommandResult<unknown>)
        : ((await ensureCommand(AGENT.name)) as CommandResult<unknown>)
  } finally {
    legacyControl.clear()
  }

  const decision = legacyDecision(world)
  return {
    artifactPresent: world.artifactPresent,
    cli: normalizeCliResult(result, operation),
    decision,
    events: [...world.events],
    incomparableFields: incomparableV1Fields(),
    observation: normalizeObservation(world.initialObservation),
    receipt: normalizeReceipt(world.state.lifecycleReceipts[AGENT.name]),
    recordWrites: world.recordWrites,
    selectedEngines: ['legacy'],
    stateDelta: normalizeStateDelta(world.initialDocument, world.state),
    typedOutcome: normalizeLegacyOutcome(world, decision),
    worldId: world.id,
  }
}

async function runCore(operation: Operation, scenario: DifferentialScenario): Promise<DifferentialSnapshot> {
  const world = createWorld('core', operation, scenario)
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
    executeCoreInstallation({ mode: 'apply', name: AGENT.name, operation }, context, ports),
  )
  const decision = normalizeCoreDecision(directive)

  return {
    artifactPresent: world.artifactPresent,
    cli: projectCoreCli(outcome, decision, operation, world.recipeState),
    decision,
    diagnostics: coreDiagnostics(outcome),
    events: [...world.events],
    incomparableFields: incomparableV1Fields(),
    observation: normalizeObservation(world.initialObservation),
    receipt: normalizeReceipt(world.state.lifecycleReceipts[AGENT.name]),
    recordWrites: world.recordWrites,
    selectedEngines: ['core'],
    stateDelta: normalizeStateDelta(world.initialDocument, world.state),
    typedOutcome: normalizeCoreOutcome(outcome),
    worldId: world.id,
  }
}

function createWorld(
  engine: MutableWorld['engine'],
  operation: Operation,
  scenario: DifferentialScenario,
): MutableWorld {
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
    engine,
    events: [],
    id: `${engine}:${operation}:${scenario.name}:${crypto.randomUUID()}`,
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
        executablePath: executable.present ? executable.path : undefined,
        kind: 'present',
        observedAt,
        targetId: AGENT.name,
        version: executable.present ? executable.version : undefined,
      },
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

  if (!world.artifactPresent) {
    return {
      ...base,
      ...(stateBinding ? { binding: stateBinding } : {}),
      capabilities: [],
      observation: {
        drift: { kind: stateBinding ? 'recorded-absent' : 'none' },
        kind: 'absent',
        observedAt,
        targetId: AGENT.name,
      },
    }
  }

  const managed = Boolean(stateBinding && receiptBinding && providerBindingsEqual(stateBinding, receiptBinding))
  const liveBinding = managed ? (receiptBinding ?? stateBinding) : world.installedByEngine ? catalogBinding : undefined
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

function legacyDecision(world: MutableWorld): CanonicalDecision {
  switch (world.scenario.initial) {
    case 'conflict':
      return 'blocked-conflict'
    case 'external':
      return 'external-preserved'
    case 'indeterminate':
      return 'blocked-indeterminate'
    case 'stale':
      return 'reinstall'
    case 'managed':
      return 'already-satisfied'
    case 'missing':
      return 'install'
  }
}

function normalizeCoreDecision(directive: ReturnType<typeof decideCoreInstallation>): CanonicalDecision {
  if (directive.kind === 'blocked') {
    return directive.code === 'conflict' ? 'blocked-conflict' : 'blocked-indeterminate'
  }
  if (directive.kind === 'interrupted') return 'blocked-indeterminate'
  return directive.decision
}

function normalizeLegacyOutcome(world: MutableWorld, decision: CanonicalDecision): CommonTypedOutcome {
  if (decision === 'external-preserved') return { changed: false, kind: 'success' }
  const outcome = world.legacyOutcome
  if (!outcome) throw new Error('The legacy engine did not expose a typed outcome.')
  if (outcome.kind === 'success') return { changed: outcome.value.changed, kind: 'success' }
  if (outcome.kind === 'cancelled') return { kind: 'cancelled' }
  if (outcome.kind === 'timed-out') return { kind: 'timed-out' }
  if (decision === 'blocked-conflict') return { code: 'decision-conflict', kind: 'failure' }
  if (decision === 'blocked-indeterminate') return { code: 'decision-indeterminate', kind: 'failure' }
  return { code: 'verification-failed', kind: 'failure' }
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
): DifferentialSnapshot['diagnostics'] {
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

function normalizeObservation(observed: CoreAgentObservation): CanonicalObservation {
  const observation = observed.observation
  const status: CanonicalObservation['status'] =
    observation.drift.kind === 'conflicting-source'
      ? 'conflict'
      : observation.kind === 'indeterminate' || observation.drift.kind === 'indeterminate'
        ? 'indeterminate'
        : observation.kind === 'absent'
          ? observation.drift.kind === 'recorded-absent'
            ? 'stale'
            : 'missing'
          : observation.drift.kind === 'untracked'
            ? 'external'
            : 'managed'
  const binding = observed.persistedBinding ?? observed.binding
  return {
    ...(observed.receipt ? { receipt: normalizeReceipt(observed.receipt) } : {}),
    ...(binding
      ? {
          source: {
            providerId: binding.providerId,
            targetId: binding.target.id,
            targetKind: binding.target.kind,
          },
        }
      : {}),
    ...(observed.installedState ? { state: clone(observed.installedState) } : {}),
    status,
  }
}

function normalizeStateDelta(before: VersionedQuantexState, after: VersionedQuantexState): NormalizedStateDelta {
  return {
    installedState: compactPair(before.installedAgents[AGENT.name], after.installedAgents[AGENT.name]),
    receipt: compactPair(
      normalizeReceipt(before.lifecycleReceipts[AGENT.name]),
      normalizeReceipt(after.lifecycleReceipts[AGENT.name]),
    ),
  }
}

function compactPair<T>(before: T | undefined, after: T | undefined): { readonly after?: T; readonly before?: T } {
  return {
    ...(before === undefined ? {} : { before: clone(before) }),
    ...(after === undefined ? {} : { after: clone(after) }),
  }
}

function normalizeReceipt(receipt: LifecycleReceipt | undefined): NormalizedReceipt | undefined {
  if (!receipt) return undefined
  return {
    ...(receipt.executableName ? { executableName: receipt.executableName } : {}),
    ...(receipt.executablePath ? { executablePath: receipt.executablePath } : {}),
    kind: receipt.kind,
    providerId: receipt.providerId,
    providerTargetId: receipt.providerTargetId,
    ...(receipt.providerTargetKind ? { providerTargetKind: receipt.providerTargetKind } : {}),
    schemaVersion: receipt.schemaVersion,
    targetId: receipt.targetId,
    ...(receipt.version ? { version: receipt.version } : {}),
  }
}

function receiptFor(
  binding: LifecycleProviderBinding,
  version: string,
  executablePath: string,
  verifiedAt: string,
): LifecycleReceipt {
  return {
    ...(binding.target.binaryName ? { executableName: binding.target.binaryName } : {}),
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

function normalizeCliResult(result: CommandResult<unknown>, operation: Operation): NormalizedCliProjection {
  const data = (result.data ?? {}) as {
    changed?: boolean
    installed?: boolean
    installState?: { installType: string; packageName?: string }
  }
  return {
    action: operation,
    changed: data.changed ?? false,
    error: result.error
      ? {
          code: result.error.code,
          ...(typeof result.error.details?.lifecycle === 'string' ? { lifecycle: result.error.details.lifecycle } : {}),
        }
      : null,
    installed: data.installed ?? false,
    ...(data.installState
      ? {
          installState: {
            installType: data.installState.installType,
            ...(data.installState.packageName ? { packageName: data.installState.packageName } : {}),
          },
        }
      : {}),
    ok: result.ok,
    warningCodes: result.warnings.map(warning => warning.code).filter((code): code is string => Boolean(code)),
  }
}

function projectCoreCli(
  outcome: CoreInvocationOutcome<CoreInstallationExecutionOutcome>,
  decision: CanonicalDecision,
  operation: Operation,
  installedState: InstalledAgentState,
): NormalizedCliProjection {
  const typed = normalizeCoreOutcome(outcome)
  if (typed.kind === 'success') {
    if (decision === 'already-satisfied') {
      return cliSuccess(operation, false, true, undefined, ['ALREADY_INSTALLED'])
    }
    if (decision === 'external-preserved') {
      return cliSuccess(operation, false, true, undefined, ['UNTRACKED_EXISTING_INSTALL'])
    }
    return cliSuccess(operation, typed.changed, true, installedState, [])
  }

  const lifecycle =
    typed.kind === 'failure' &&
    (typed.code === 'decision-conflict' ||
      typed.code === 'decision-indeterminate' ||
      typed.code === 'verification-failed')
      ? 'verification-failed'
      : undefined
  return {
    action: operation,
    changed: false,
    error: {
      code: typed.kind === 'cancelled' ? 'CANCELLED' : 'INSTALL_FAILED',
      ...(lifecycle ? { lifecycle } : {}),
    },
    installed: false,
    ok: false,
    warningCodes: [],
  }
}

function cliSuccess(
  action: Operation,
  changed: boolean,
  installed: boolean,
  installedState: InstalledAgentState | undefined,
  warningCodes: readonly string[],
): NormalizedCliProjection {
  return {
    action,
    changed,
    error: null,
    installed,
    ...(installedState
      ? {
          installState: {
            installType: installedState.installType,
            ...(installedState.packageName ? { packageName: installedState.packageName } : {}),
          },
        }
      : {}),
    ok: true,
    warningCodes,
  }
}

function incomparableV1Fields(): readonly string[] {
  return [
    'receipt.verifiedAt (engine-local clock)',
    'recordWrites (implementation-only; semantic state delta compared)',
    'typedOutcome.phase (not reported by v1)',
    'typedOutcome.sideEffect (not reported by v1)',
  ]
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
