import type { AgentDefinition } from '../../src/agents'
import type { LifecycleReceipt } from '../../src/lifecycle'
import type { ProviderAdapter, ProviderObservation, ProviderOutcome, ProviderRegistry } from '../../src/providers'
import type { InstalledAgentState } from '../../src/state'
import { describe, expect, it, vi } from 'vitest'
import { type AgentLifecycleObservationPorts, observeAgentLifecycle } from '../../src/lifecycle/agent-observation'

type ObservationOutcome = ProviderOutcome<ProviderObservation>

interface Scenario {
  readonly expected: {
    readonly binding?: { providerId: string; target: { id: string; kind: string } }
    readonly capabilities?: readonly string[]
    readonly drift: string
    readonly kind: string
    readonly path?: string
    readonly pathExecutable?: Scenario['executable']
    readonly providerId?: string
    readonly providerOutcomeKind?: ObservationOutcome['kind']
    readonly version?: string
  }
  readonly executable?: { readonly path?: string; readonly present: boolean; readonly version?: string }
  readonly name: string
  readonly outcomes?: Partial<Record<'bun' | 'cargo' | 'npm', ObservationOutcome>>
  readonly receipt?: LifecycleReceipt
  readonly rejectingProviders?: readonly ('bun' | 'cargo' | 'npm')[]
  readonly state?: InstalledAgentState
}

const absent = (providerId: 'bun' | 'cargo' | 'npm'): ObservationOutcome => ({
  kind: 'success',
  value: {
    kind: 'absent',
    target: { id: providerId === 'cargo' ? 'test-cargo' : 'test-pkg', kind: 'package' },
  },
})

const present = (providerId: 'bun' | 'cargo' | 'npm', path = '/bin/test-bin'): ObservationOutcome => ({
  kind: 'success',
  value: {
    executablePath: path,
    kind: 'present',
    target: { id: providerId === 'cargo' ? 'test-cargo' : 'test-pkg', kind: 'package' },
    version: providerId === 'bun' ? '1.2.3' : '2.0.0',
  },
})

const legacyState: InstalledAgentState = {
  agentName: 'test-agent',
  installType: 'bun',
}

const receipt: LifecycleReceipt = {
  executableName: 'test-bin',
  executablePath: '/bin/test-bin',
  kind: 'lifecycle-receipt',
  providerId: 'bun',
  providerTargetId: 'test-pkg',
  providerTargetKind: 'package',
  schemaVersion: 1,
  targetId: 'test-agent',
  verifiedAt: '2026-07-12T03:00:00.000Z',
  version: '1.2.3',
}

const scenarios: readonly Scenario[] = [
  {
    expected: { drift: 'none', kind: 'absent' },
    name: 'reports absent when PATH and every catalog provider are conclusively absent',
  },
  {
    executable: { path: '/bin/test-bin', present: true, version: '1.2.3' },
    expected: {
      drift: 'untracked',
      kind: 'present',
      path: '/bin/test-bin',
      version: '1.2.3',
    },
    name: 'reports a PATH-only executable as untracked without inventing provider ownership',
  },
  {
    executable: { path: '/bin/test-bin', present: true, version: '1.2.3' },
    expected: {
      binding: { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
      capabilities: ['availability', 'observe', 'update'],
      drift: 'untracked',
      kind: 'present',
      path: '/bin/test-bin',
      providerId: 'bun',
      version: '1.2.3',
    },
    name: 'uses exactly one live catalog candidate as untracked provider ownership',
    outcomes: { bun: present('bun') },
  },
  {
    executable: { path: '/bin/test-bin', present: true },
    expected: { drift: 'conflicting-source', kind: 'present', path: '/bin/test-bin' },
    name: 'reports multiple live catalog candidates as conflicting source evidence',
    outcomes: { bun: present('bun'), npm: present('npm') },
  },
  {
    executable: { path: '/bin/test-bin', present: true },
    expected: { drift: 'conflicting-source', kind: 'present', path: '/bin/test-bin' },
    name: 'keeps conclusive multiple-live conflict ahead of another candidate failure',
    outcomes: {
      bun: present('bun'),
      cargo: { kind: 'failed', reason: 'cargo probe failed', retryable: true },
      npm: present('npm'),
    },
  },
  {
    expected: { drift: 'conflicting-source', kind: 'indeterminate' },
    name: 'reports multiple live candidates as conflicting even when PATH is absent',
    outcomes: { bun: present('bun'), npm: present('npm') },
  },
  {
    executable: { path: '/bin/test-bin', present: true },
    expected: { drift: 'indeterminate', kind: 'indeterminate', path: '/bin/test-bin' },
    name: 'fails closed when a candidate probe is unresolved while PATH is present',
    outcomes: {
      bun: {
        kind: 'failed',
        reason: 'probe failed',
        retryable: true,
      },
    },
  },
  {
    executable: { path: '/bin/test-bin', present: true, version: '1.2.3' },
    expected: {
      binding: { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
      capabilities: ['availability', 'observe', 'update'],
      drift: 'none',
      kind: 'present',
      path: '/bin/test-bin',
      providerId: 'bun',
      version: '1.2.3',
    },
    name: 'verifies matching installed state and receipt against live evidence',
    outcomes: { bun: present('bun') },
    receipt: receipt,
    state: legacyState,
  },
  {
    executable: { path: '/bin/test-bin', present: true },
    expected: { drift: 'indeterminate', kind: 'indeterminate', path: '/bin/test-bin' },
    name: 'fails closed when persisted receipt binding cannot be resolved',
    receipt: { ...receipt, providerId: 'unknown-provider' },
  },
  {
    executable: { path: '/bin/test-bin', present: true, version: '1.2.3' },
    expected: {
      binding: { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
      capabilities: ['availability', 'observe', 'update'],
      drift: 'conflicting-source',
      kind: 'present',
      path: '/bin/test-bin',
      providerId: 'bun',
      version: '1.2.3',
    },
    name: 'reports a changed executable path against recorded receipt identity',
    outcomes: { bun: present('bun') },
    receipt: { ...receipt, executablePath: '/old/test-bin' },
    state: legacyState,
  },
  {
    executable: { path: '/bin/test-bin', present: true },
    expected: {
      binding: { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
      capabilities: ['availability', 'observe', 'update'],
      drift: 'conflicting-source',
      kind: 'present',
      path: '/bin/test-bin',
    },
    name: 'rejects provider evidence for a different target identity',
    outcomes: {
      bun: {
        kind: 'success',
        value: {
          kind: 'present',
          target: { id: 'other-package', kind: 'package' },
        },
      },
    },
    receipt,
    state: legacyState,
  },
  {
    executable: { path: '/bin/test-bin', present: true },
    expected: {
      binding: { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
      capabilities: ['availability', 'observe', 'update'],
      drift: 'indeterminate',
      kind: 'indeterminate',
      path: '/bin/test-bin',
      providerOutcomeKind: 'failed',
    },
    name: 'normalizes a persisted provider adapter rejection to indeterminate',
    receipt,
    rejectingProviders: ['bun'],
    state: legacyState,
  },
  {
    executable: { path: '/bin/test-bin', present: true },
    expected: {
      drift: 'indeterminate',
      kind: 'indeterminate',
      path: '/bin/test-bin',
      providerOutcomeKind: 'failed',
    },
    name: 'normalizes a catalog candidate adapter rejection to indeterminate',
    rejectingProviders: ['bun'],
  },
  {
    executable: { path: '/bin/test-bin', present: true, version: '1.2.3' },
    expected: {
      binding: { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
      capabilities: ['availability', 'observe', 'update'],
      drift: 'none',
      kind: 'present',
      path: '/bin/test-bin',
      providerId: 'bun',
      version: '1.2.3',
    },
    name: 'verifies legacy installed state without requiring a receipt',
    outcomes: { bun: present('bun') },
    state: legacyState,
  },
  {
    expected: {
      binding: { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
      capabilities: ['availability', 'observe', 'update'],
      drift: 'recorded-absent',
      kind: 'absent',
    },
    name: 'reports a conclusive ghost when recorded and live evidence are absent',
    receipt,
    state: legacyState,
  },
  {
    executable: { path: '/bin/test-bin', present: true },
    expected: { drift: 'conflicting-source', kind: 'present', path: '/bin/test-bin' },
    name: 'reports conflicting state and receipt provider bindings',
    receipt: { ...receipt, providerId: 'npm' },
    state: legacyState,
  },
  {
    expected: {
      binding: { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
      capabilities: ['availability', 'observe', 'update'],
      drift: 'conflicting-source',
      kind: 'present',
      path: '/bin/test-bin',
      pathExecutable: { present: false },
      providerId: 'bun',
      version: '1.2.3',
    },
    name: 'reports provider-present and PATH-absent evidence as conflicting',
    outcomes: { bun: present('bun') },
    receipt,
    state: legacyState,
  },
  {
    executable: { path: '/bin/test-bin', present: true, version: '1.2.3' },
    expected: {
      binding: { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
      capabilities: ['availability', 'observe', 'update'],
      drift: 'conflicting-source',
      kind: 'present',
      path: '/bin/test-bin',
      version: '1.2.3',
    },
    name: 'reports provider-absent and PATH-present evidence as conflicting',
    receipt,
    state: legacyState,
  },
  {
    executable: { path: '/bin/test-bin', present: true },
    expected: {
      binding: { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
      capabilities: ['availability', 'observe', 'update'],
      drift: 'indeterminate',
      kind: 'indeterminate',
      path: '/bin/test-bin',
    },
    name: 'maps a typed unsupported provider observation to indeterminate drift',
    outcomes: { bun: { kind: 'unsupported', operation: 'observe' } },
    receipt,
    state: legacyState,
  },
  {
    executable: { path: '/bin/test-bin', present: true },
    expected: {
      binding: { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
      capabilities: ['availability', 'observe', 'update'],
      drift: 'indeterminate',
      kind: 'indeterminate',
      path: '/bin/test-bin',
    },
    name: 'preserves a typed indeterminate provider outcome',
    outcomes: { bun: { kind: 'indeterminate', reason: 'ambiguous provider state' } },
    receipt,
    state: legacyState,
  },
]

describe('observeAgentLifecycle', () => {
  for (const scenario of scenarios) {
    it(scenario.name, async () => {
      const mutateState = vi.fn(() => {
        throw new Error('observer must not mutate state')
      })
      const readInstalledState = vi.fn(async () => scenario.state)
      const readReceipt = vi.fn(async () => scenario.receipt)
      const registry = createRegistry(scenario.outcomes, scenario.rejectingProviders)
      const ports: AgentLifecycleObservationPorts & { mutateState: typeof mutateState } = {
        clock: () => '2026-07-12T04:00:00.000Z',
        inspectExecutable: vi.fn(async () => scenario.executable ?? { present: false }),
        mutateState,
        platform: 'linux',
        providerRegistry: registry,
        readInstalledState,
        readReceipt,
        signal: new AbortController().signal,
      }

      const result = await observeAgentLifecycle(agent, ports)

      expect(result.observation.kind).toBe(scenario.expected.kind)
      expect(result.observation.drift.kind).toBe(scenario.expected.drift)
      expect(result.binding).toMatchObject(scenario.expected.binding ?? {})
      if (!scenario.expected.binding) expect(result.binding).toBeUndefined()
      expect(result.capabilities).toEqual(scenario.expected.capabilities ?? [])
      expect(result.executable.path).toBe(scenario.expected.path)
      expect(result.executable.version).toBe(scenario.expected.version)
      if (scenario.expected.pathExecutable) {
        expect(result.pathExecutable).toEqual(scenario.expected.pathExecutable)
      }
      if (scenario.expected.providerOutcomeKind) {
        expect(result.providerOutcome?.kind).toBe(scenario.expected.providerOutcomeKind)
      }
      if (result.observation.kind === 'present') {
        expect(result.observation.providerId).toBe(scenario.expected.providerId)
        expect(result.observation.executablePath).toBe(scenario.expected.path)
        expect(result.observation.version).toBe(scenario.expected.version)
      }
      expect(result.installedState).toBe(scenario.state)
      expect(result.receipt).toBe(scenario.receipt)
      expect(result.catalogMethods).toEqual([
        { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
        { providerId: 'npm', target: { id: 'test-pkg', kind: 'package' } },
        { providerId: 'cargo', target: { id: 'test-cargo', kind: 'package' } },
      ])
      expect(readInstalledState).toHaveBeenCalledWith('test-agent')
      expect(readReceipt).toHaveBeenCalledWith('test-agent')
      expect(mutateState).not.toHaveBeenCalled()
    })
  }

  for (const providerId of ['brew', 'winget'] as const) {
    it(`fails closed for an unresolved ${providerId} catalog candidate`, async () => {
      const unresolvedAgent: AgentDefinition = {
        ...agent,
        packages: undefined,
        platforms: { linux: [{ type: providerId }] },
      }
      const result = await observeAgentLifecycle(unresolvedAgent, {
        clock: () => '2026-07-12T04:00:00.000Z',
        inspectExecutable: async () => ({ path: '/bin/test-bin', present: true }),
        platform: 'linux',
        providerRegistry: createRegistry(),
        readInstalledState: async () => undefined,
        readReceipt: async () => undefined,
        signal: new AbortController().signal,
      })

      expect(result.observation.kind).toBe('indeterminate')
      expect(result.observation.drift.kind).toBe('indeterminate')
      expect(result.binding).toBeUndefined()
    })
  }
})

function createRegistry(
  outcomes: Scenario['outcomes'] = {},
  rejectingProviders: Scenario['rejectingProviders'] = [],
): ProviderRegistry {
  const adapters = (['bun', 'npm', 'cargo'] as const).map(providerId => {
    const adapter: ProviderAdapter = {
      availability: async () => ({ kind: 'success', value: { executable: providerId } }),
      id: providerId,
      observe: async request => {
        if (rejectingProviders.includes(providerId)) throw new Error(`${providerId} adapter rejected`)
        return outcomes[providerId] ?? absent(providerId)
      },
      ...(providerId === 'bun'
        ? {
            update: async request => ({
              kind: 'success' as const,
              value: { evidence: [], target: request.target },
            }),
          }
        : {}),
    }
    return adapter
  })

  return {
    get: id => adapters.find(adapter => adapter.id === id),
    getCapabilities: id => (id === 'bun' ? ['availability', 'observe', 'update'] : ['availability', 'observe']),
    list: () => adapters,
  }
}

const agent: AgentDefinition = {
  binaryName: 'test-bin',
  displayName: 'Test Agent',
  homepage: 'https://example.com',
  name: 'test-agent',
  packages: { npm: 'test-pkg' },
  platforms: {
    linux: [
      { packageName: 'test-pkg', type: 'bun' },
      { packageName: 'test-pkg', type: 'npm' },
      { packageName: 'test-cargo', type: 'cargo' },
    ],
  },
}
