import type { AgentDefinition, InstallMethod } from '../../src/agents'
import type { CoreInstallationRecipe } from '../../src/core/installation-executor'
import type { CoreInvocationContext } from '../../src/core/invocation'
import type { CoreAgentObservation } from '../../src/core/production-observation'
import type {
  LifecycleUpdateObservedAgent,
  LifecycleUpdateServicePorts,
  ManagedAgentLifecycleUpdatePlan,
} from '../../src/core/update-executor'
import type { LifecycleObservation, LifecycleReceipt } from '../../src/lifecycle'
import type { LifecycleProviderBinding } from '../../src/lifecycle/provider-binding'
import type { ProviderAdapter, ProviderId } from '../../src/providers'
import type { InstalledAgentState, VersionedQuantexState } from '../../src/state/schema'
import type { StateDocumentPersistence } from '../../src/state/store'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const legacyControl = vi.hoisted(() => {
  const receiptWrites: Array<{ installedState: unknown; receipt: unknown }> = []

  return {
    createCliOperationContext: () => ({
      context: {
        outputPolicy: 'stderr' as const,
        signal: new AbortController().signal,
      },
      dispose: () => undefined,
      run: async <T>(invoke: () => Promise<T>) => invoke(),
    }),
    getCliContext: () => ({
      cacheMode: 'default' as const,
      cancelled: false,
      colorMode: 'never' as const,
      interactive: false,
      logLevel: 'silent' as const,
      outputMode: 'json' as const,
      quiet: true,
      runId: 'lifecycle-receipt-contract',
    }),
    isBinaryInPath: async () => true,
    observeLifecycleProvider: async (binding: { target: object }) => ({
      kind: 'success' as const,
      value: {
        executablePath: '/isolated/bin/receipt-agent',
        kind: 'present' as const,
        target: binding.target,
        version: '1.0.0',
      },
    }),
    receiptWrites,
    setAgentLifecycleEvidence: async (installedState: unknown, receipt: unknown) => {
      receiptWrites.push({ installedState, receipt })
    },
    withAgentLifecycleLock: async <T>(run: () => Promise<T>): Promise<T> => run(),
  }
})

vi.mock('../../src/cli-context', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/cli-context')>()
  return { ...actual, getCliContext: legacyControl.getCliContext }
})

vi.mock('../../src/package-manager', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/package-manager')>()
  return { ...actual, withAgentLifecycleLock: legacyControl.withAgentLifecycleLock }
})

vi.mock('../../src/runtime/cli-operation-context', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/runtime/cli-operation-context')>()
  return { ...actual, createCliOperationContext: legacyControl.createCliOperationContext }
})

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

import { createProductionCoreInstallationPorts } from '../../src/core/installation-production'
import { executeSingleAgentLifecycleUpdate } from '../../src/core/update-executor'
import { reconcileAgentInstallation } from '../../src/lifecycle/agent-installation'
import {
  providerBindingsEqual,
  resolveInstallMethodProviderBinding,
  resolvePersistedProviderBinding,
  resolveReceiptProviderBinding,
  resolveStateProviderBinding,
} from '../../src/lifecycle/provider-binding'
import { planLifecycleUpdate } from '../../src/lifecycle/update-planner'
import { buildInstalledAgentState } from '../../src/package-manager'
import { firstPartyProviderIds } from '../../src/providers'
import { createProviderRegistry } from '../../src/providers/registry'
import { createEmptyStateDocument } from '../../src/state/schema'
import { LifecycleStateStore } from '../../src/state/store'

const VERIFIED_AT = '2026-08-15T01:02:03.000Z'

const agent: AgentDefinition = {
  binaryName: 'receipt-agent',
  displayName: 'Receipt Agent',
  homepage: 'https://example.com/receipt-agent',
  name: 'receipt-agent',
  packages: { npm: 'receipt-agent-npm' },
  platforms: {},
}

interface ProviderFixture {
  binding: LifecycleProviderBinding
  method: InstallMethod
  providerId: ProviderId
  state: InstalledAgentState
}

describe('lifecycle receipt writer/reader contract', () => {
  beforeEach(() => {
    legacyControl.receiptWrites.length = 0
  })

  it.each(firstPartyProviderIds)('reconciles legacy, Core, and update receipts for %s', async providerId => {
    const fixture = createProviderFixture(providerId)
    const legacyReceipt = await captureLegacyReceipt(fixture)
    const coreReceipt = await captureCoreReceipt(fixture)
    const updateReceipt = await captureUpdateReceipt(fixture)

    for (const receipt of [legacyReceipt, coreReceipt, updateReceipt]) {
      expectReceiptToReconcile(fixture, receipt)
    }

    if (providerId === 'deno' || providerId === 'script' || providerId === 'binary') {
      expect(legacyReceipt.executableName).toBe(agent.binaryName)
      expect(coreReceipt.executableName).toBe(agent.binaryName)
    } else {
      expect(legacyReceipt.executableName).toBeUndefined()
      expect(coreReceipt.executableName).toBeUndefined()
    }
    expect(updateReceipt.executableName).toBe(agent.binaryName)
  })

  it('continues to reject a genuinely different executable as a conflicting source', async () => {
    const fixture = createProviderFixture('bun')
    const receipt = await captureUpdateReceipt(fixture)
    const stateBinding = resolveStateProviderBinding(agent, fixture.state)
    const conflictingReceiptBinding = resolveReceiptProviderBinding({
      ...receipt,
      executableName: 'different-receipt-agent',
    })

    expect(stateBinding).toBeDefined()
    expect(conflictingReceiptBinding).toBeDefined()
    expect(providerBindingsEqual(stateBinding!, conflictingReceiptBinding!, agent.binaryName)).toBe(false)
  })
})

function createProviderFixture(providerId: ProviderId): ProviderFixture {
  const method = createProviderMethod(providerId)
  const state = buildInstalledAgentState(agent, method)
  const binding = resolveInstallMethodProviderBinding(agent, method)
  if (!binding) throw new Error(`Unable to resolve fixture binding for ${providerId}.`)
  return { binding, method, providerId, state }
}

function createProviderMethod(providerId: ProviderId): InstallMethod {
  switch (providerId) {
    case 'bun':
      return { packageName: 'receipt-agent-bun', type: 'bun' }
    case 'npm':
      return { packageName: 'receipt-agent-npm', type: 'npm' }
    case 'brew':
      return { packageName: 'receipt-agent/brew', type: 'brew' }
    case 'cargo':
      return { packageName: 'receipt-agent-cargo', type: 'cargo' }
    case 'deno':
      return {
        binaryName: agent.binaryName,
        packageInstallArgs: ['--allow-net'],
        packageName: 'jsr:@scope/receipt-agent-deno',
        type: 'deno',
      }
    case 'mise':
      return { packageName: 'npm:receipt-agent-mise', type: 'mise' }
    case 'pip':
      return { packageName: 'receipt-agent-pip', type: 'pip' }
    case 'uv':
      return { packageInstallArgs: ['--python', '3.12'], packageName: 'receipt-agent-uv', type: 'uv' }
    case 'winget':
      return { packageName: 'Receipt.Agent', packageTargetKind: 'id', type: 'winget' }
    case 'script':
      return {
        binaryName: agent.binaryName,
        command: 'curl https://example.com/receipt-agent | sh',
        type: 'script',
      }
    case 'binary':
      return {
        binaryName: agent.binaryName,
        command: 'receipt-agent-installer --install receipt-agent',
        type: 'binary',
      }
  }
}

async function captureLegacyReceipt(fixture: ProviderFixture): Promise<LifecycleReceipt> {
  const result = await reconcileAgentInstallation({
    adoptableMethod: fixture.method,
    agent,
    observation: {
      inPath: true,
      lifecycle: presentObservation(fixture.binding, 'untracked'),
      methods: [fixture.method],
    },
    operation: 'install',
    route: 'adopt',
  })

  expect(result.kind).toBe('success')
  const write = legacyControl.receiptWrites.at(-1)
  expect(write).toBeDefined()
  if (!write) throw new Error(`Legacy writer did not record ${fixture.providerId}.`)
  expect(result).toMatchObject({ kind: 'success', value: { receipt: write.receipt } })
  return write.receipt as LifecycleReceipt
}

async function captureCoreReceipt(fixture: ProviderFixture): Promise<LifecycleReceipt> {
  const persistence = memoryPersistence(createEmptyStateDocument())
  const ports = createProductionCoreInstallationPorts({
    acquireResourceLock: async () => async () => undefined,
    clock: () => VERIFIED_AT,
    configDir: '/isolated/receipt-contract',
    platform: 'linux',
    providerRegistry: createProviderRegistry([]),
    recipeCatalog: [],
    stateStore: new LifecycleStateStore(persistence.port),
  })
  const recipe: CoreInstallationRecipe = {
    binding: fixture.binding,
    compensation: 'manual',
    installedState: fixture.state,
    ownership: 'created-on-success',
  }
  const record = await ports.prepareRecord({
    before: coreObservation(fixture, 'untracked'),
    context: coreContext(),
    recipe,
    verified: coreObservation(fixture, 'none', fixture.state),
  })
  await record.apply()
  await record.commit()

  const receipt = persistence.value.lifecycleReceipts[agent.name]
  expect(receipt).toBeDefined()
  if (!receipt) throw new Error(`Core writer did not record ${fixture.providerId}.`)
  return receipt
}

async function captureUpdateReceipt(fixture: ProviderFixture): Promise<LifecycleReceipt> {
  const before = updateObservation(fixture, '1.0.0')
  const after = updateObservation(fixture, '2.0.0')
  const planning = planLifecycleUpdate({
    intent: { kind: 'update', targetId: agent.name, targetVersion: '2.0.0' },
    observation: before.observation,
    provider: {
      capabilities: ['observe', 'update', 'verify'],
      providerId: fixture.providerId,
      targetId: fixture.binding.target.id,
      targetKind: fixture.binding.target.kind,
    },
  })
  expect(planning.decision).toBe('upgrade')

  const planned: ManagedAgentLifecycleUpdatePlan = {
    before,
    binding: fixture.binding,
    plannedTargetVersion: '2.0.0',
    planning,
    strategy: 'managed-provider',
  }
  const adapter = createUpdateAdapter(fixture)
  let receipt: LifecycleReceipt | undefined
  const ports: LifecycleUpdateServicePorts = {
    clock: () => VERIFIED_AT,
    dryRun: false,
    observe: async () => after,
    planLifecycleUpdate,
    providerRegistry: createProviderRegistry([adapter]),
    signal: new AbortController().signal,
    writeReceipt: async next => {
      receipt = next
    },
  }

  const result = await executeSingleAgentLifecycleUpdate(planned, ports)
  expect(result).toMatchObject({ kind: 'updated' })
  expect(receipt).toBeDefined()
  if (!receipt) throw new Error(`Update writer did not record ${fixture.providerId}.`)
  return receipt
}

function expectReceiptToReconcile(fixture: ProviderFixture, receipt: LifecycleReceipt): void {
  const stateBinding = resolveStateProviderBinding(agent, fixture.state)
  const receiptBinding = resolveReceiptProviderBinding(receipt)
  expect(stateBinding).toBeDefined()
  expect(receiptBinding).toBeDefined()
  expect(providerBindingsEqual(stateBinding!, receiptBinding!, agent.binaryName)).toBe(true)
  expect(resolvePersistedProviderBinding(stateBinding, receiptBinding, agent.binaryName)).toMatchObject({
    providerId: fixture.providerId,
    target: {
      id: fixture.binding.target.id,
      kind: fixture.binding.target.kind,
    },
  })
}

function presentObservation(
  binding: LifecycleProviderBinding,
  drift: 'none' | 'untracked',
  version = '1.0.0',
): Extract<LifecycleObservation, { kind: 'present' }> {
  return {
    drift: { kind: drift },
    executablePath: '/isolated/bin/receipt-agent',
    kind: 'present',
    providerId: binding.providerId,
    providerTargetId: binding.target.id,
    providerTargetKind: binding.target.kind,
    targetId: agent.name,
    version,
  }
}

function coreObservation(
  fixture: ProviderFixture,
  drift: 'none' | 'untracked',
  installedState?: InstalledAgentState,
): CoreAgentObservation {
  const observation = presentObservation(fixture.binding, drift)
  const executable = { path: observation.executablePath, present: true, version: observation.version }
  return {
    agent,
    binding: fixture.binding,
    capabilities: ['observe', 'install', 'verify'],
    catalogMethods: [fixture.binding],
    executable,
    installedState,
    methods: [fixture.method],
    observation,
    pathExecutable: executable,
    persistedBinding: fixture.binding,
    resolvedBinaryPath: observation.executablePath,
  }
}

function updateObservation(fixture: ProviderFixture, version: string): LifecycleUpdateObservedAgent {
  const observation = presentObservation(fixture.binding, 'none', version)
  return {
    agent: {
      binaryName: agent.binaryName,
      displayName: agent.displayName,
      name: agent.name,
    },
    binding: fixture.binding,
    capabilities: ['observe', 'update', 'verify'],
    executable: { path: observation.executablePath, present: true, version },
    installedState: fixture.state,
    methods: [fixture.method],
    observation,
    persistedBinding: fixture.binding,
  }
}

function createUpdateAdapter(fixture: ProviderFixture): ProviderAdapter {
  return {
    availability: async () => ({ kind: 'success', value: { executable: fixture.providerId } }),
    id: fixture.providerId,
    observe: async ({ target }) => ({
      kind: 'success',
      value: { kind: 'present', target, version: '2.0.0' },
    }),
    update: async ({ target }) => ({ kind: 'success', value: { evidence: [], target } }),
    verify: async () => ({ kind: 'success', value: { evidence: [], kind: 'satisfied' } }),
  }
}

function coreContext(): CoreInvocationContext {
  return {
    registerCleanup: () => () => undefined,
    setInterruptionDetails: () => undefined,
    signal: new AbortController().signal,
  }
}

function memoryPersistence(initial: VersionedQuantexState): {
  port: StateDocumentPersistence
  readonly value: VersionedQuantexState
} {
  let value = structuredClone(initial)
  return {
    port: {
      load: async () => structuredClone(value),
      save: async next => {
        value = structuredClone(next)
      },
    },
    get value() {
      return value
    },
  }
}
