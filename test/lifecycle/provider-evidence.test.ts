import type { AgentDefinition } from '../../src/agents'
import type { LifecycleReceipt } from '../../src/lifecycle'
import type { ProviderAdapter, ProviderObservation, ProviderRegistry } from '../../src/providers'
import type { InstalledAgentState } from '../../src/state'
import { describe, expect, it, vi } from 'vitest'
import {
  observeLifecycleProvider,
  resolveCatalogProviderEvidence,
  resolveReceiptProviderBinding,
  resolveStateProviderBinding,
} from '../../src/lifecycle/provider-evidence'

describe('lifecycle provider evidence', () => {
  it('resolves a legacy Bun state through catalog package metadata', () => {
    expect(resolveStateProviderBinding(agent, legacyState)).toEqual({
      providerId: 'bun',
      target: {
        id: 'test-pkg',
        kind: 'package',
      },
    })
  })

  it('resolves a receipt to the exact recorded provider target', () => {
    expect(resolveReceiptProviderBinding(receipt)).toEqual({
      providerId: 'bun',
      target: {
        id: 'test-pkg',
        kind: 'package',
      },
    })
  })

  it('carries executable identity for install-effect state and receipts', () => {
    const scriptState: InstalledAgentState = {
      agentName: 'test-agent',
      command: 'curl https://example.com/install | sh',
      installType: 'script',
    }

    expect(resolveStateProviderBinding(agent, scriptState)).toMatchObject({
      providerId: 'script',
      target: { binaryName: 'test-bin', kind: 'script' },
    })
    expect(
      resolveReceiptProviderBinding({
        ...receipt,
        executableName: 'test-bin',
        providerId: 'script',
        providerTargetId: scriptState.command!,
        providerTargetKind: 'script',
      }),
    ).toMatchObject({
      providerId: 'script',
      target: { binaryName: 'test-bin', kind: 'script' },
    })
  })

  it('fails closed for ambiguous brew receipts and preserves an explicit cask target', () => {
    const brewReceipt: LifecycleReceipt = {
      ...receipt,
      providerId: 'brew',
      providerTargetId: 'test-cask',
    }

    expect(resolveReceiptProviderBinding(brewReceipt)).toBeUndefined()
    expect(
      resolveReceiptProviderBinding({
        ...brewReceipt,
        providerTargetKind: 'cask',
      }),
    ).toEqual({
      providerId: 'brew',
      target: { id: 'test-cask', kind: 'cask' },
    })
  })

  it('deduplicates equivalent catalog bindings without reporting an unresolved candidate', () => {
    const evidence = resolveCatalogProviderEvidence(
      {
        ...agent,
        platforms: {
          linux: [
            { packageName: 'test-pkg', type: 'bun' },
            { packageName: 'test-pkg', type: 'bun' },
          ],
        },
      },
      'linux',
    )

    expect(evidence).toEqual({
      bindings: [{ providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } }],
      unresolvedCandidates: [],
    })
  })

  it('observes only the adapter and target bound by evidence', async () => {
    const observe = vi.fn(
      async (): Promise<{ kind: 'success'; value: ProviderObservation }> => ({
        kind: 'success',
        value: {
          executablePath: '/bin/test-bin',
          kind: 'present',
          target: { id: 'test-pkg', kind: 'package' },
          version: '1.2.3',
        },
      }),
    )
    const adapter: ProviderAdapter = {
      availability: async () => ({ kind: 'success', value: { executable: 'bun' } }),
      id: 'bun',
      observe,
    }
    const registry: ProviderRegistry = {
      get: id => (id === 'bun' ? adapter : undefined),
      getCapabilities: () => ['availability', 'observe'],
      list: () => [adapter],
    }

    const result = await observeLifecycleProvider(resolveReceiptProviderBinding(receipt)!, {
      registry,
      signal: new AbortController().signal,
      timeoutMs: 500,
    })

    expect(result.kind).toBe('success')
    expect(observe).toHaveBeenCalledWith({
      context: {
        signal: expect.any(AbortSignal),
        timeoutMs: 500,
      },
      target: {
        id: 'test-pkg',
        kind: 'package',
      },
    })
  })
})

const agent: AgentDefinition = {
  binaryName: 'test-bin',
  displayName: 'Test Agent',
  homepage: 'https://example.com',
  name: 'test-agent',
  packages: { npm: 'test-pkg' },
  platforms: { linux: [{ type: 'bun' }] },
}

const legacyState: InstalledAgentState = {
  agentName: 'test-agent',
  installType: 'bun',
}

const receipt: LifecycleReceipt = {
  kind: 'lifecycle-receipt',
  providerId: 'bun',
  providerTargetId: 'test-pkg',
  schemaVersion: 1,
  targetId: 'test-agent',
  verifiedAt: '2026-07-12T03:00:00.000Z',
}
