import type { AgentDefinition } from '../../src/agents'
import type { LifecycleReceipt } from '../../src/lifecycle'
import type { InstalledAgentState } from '../../src/state'
import { describe, expect, it } from 'vitest'
import {
  resolvePersistedProviderBinding,
  resolveReceiptProviderBinding,
  resolveStateProviderBinding,
} from '../../src/lifecycle/provider-binding'

const agent = {
  binaryName: 'demo',
  name: 'demo',
  packages: { cargo: 'demo-crate', deno: 'jsr:@scope/demo', uv: 'demo-tool' },
  platforms: {},
} as unknown as AgentDefinition

describe('resolvePersistedProviderBinding', () => {
  it('overlays recorded state install arguments onto an identity-matching receipt binding', () => {
    const state: InstalledAgentState = {
      agentName: 'demo',
      installType: 'cargo',
      packageInstallArgs: ['--locked'],
      packageName: 'demo-crate',
    }
    const receipt: LifecycleReceipt = {
      executableName: 'demo',
      executablePath: '/bin/demo',
      kind: 'lifecycle-receipt',
      providerId: 'cargo',
      providerTargetId: 'demo-crate',
      providerTargetKind: 'package',
      schemaVersion: 1,
      targetId: 'demo',
      verifiedAt: '2026-07-30T00:00:00.000Z',
      version: '1.0.0',
    }

    const stateBinding = resolveStateProviderBinding(agent, state)
    const receiptBinding = resolveReceiptProviderBinding(receipt)
    const persisted = resolvePersistedProviderBinding(stateBinding, receiptBinding, agent.binaryName)

    expect(persisted).toEqual({
      providerId: 'cargo',
      target: {
        arguments: ['--locked'],
        binaryName: 'demo',
        id: 'demo-crate',
        kind: 'package',
      },
    })
  })

  it('preserves uv and deno recorded arguments beside matching receipts', () => {
    const uvState: InstalledAgentState = {
      agentName: 'demo',
      installType: 'uv',
      packageInstallArgs: ['--python', '3.12'],
      packageName: 'demo-tool',
    }
    const denoState: InstalledAgentState = {
      agentName: 'demo',
      binaryName: 'demo',
      installType: 'deno',
      packageInstallArgs: ['--allow-net'],
      packageName: 'jsr:@scope/demo',
    }
    const uvReceipt: LifecycleReceipt = {
      executableName: 'demo',
      kind: 'lifecycle-receipt',
      providerId: 'uv',
      providerTargetId: 'demo-tool',
      providerTargetKind: 'tool',
      schemaVersion: 1,
      targetId: 'demo',
      verifiedAt: '2026-07-30T00:00:00.000Z',
    }
    const denoReceipt: LifecycleReceipt = {
      executableName: 'demo',
      kind: 'lifecycle-receipt',
      providerId: 'deno',
      providerTargetId: 'jsr:@scope/demo',
      providerTargetKind: 'tool',
      schemaVersion: 1,
      targetId: 'demo',
      verifiedAt: '2026-07-30T00:00:00.000Z',
    }

    expect(
      resolvePersistedProviderBinding(
        resolveStateProviderBinding(agent, uvState),
        resolveReceiptProviderBinding(uvReceipt),
        agent.binaryName,
      )?.target.arguments,
    ).toEqual(['--python', '3.12'])
    expect(
      resolvePersistedProviderBinding(
        resolveStateProviderBinding(agent, denoState),
        resolveReceiptProviderBinding(denoReceipt),
        agent.binaryName,
      )?.target.arguments,
    ).toEqual(['--allow-net'])
  })

  it('does not invent arguments when state has none', () => {
    const state: InstalledAgentState = {
      agentName: 'demo',
      installType: 'cargo',
      packageName: 'demo-crate',
    }
    const receipt: LifecycleReceipt = {
      executableName: 'demo',
      kind: 'lifecycle-receipt',
      providerId: 'cargo',
      providerTargetId: 'demo-crate',
      providerTargetKind: 'package',
      schemaVersion: 1,
      targetId: 'demo',
      verifiedAt: '2026-07-30T00:00:00.000Z',
    }

    const persisted = resolvePersistedProviderBinding(
      resolveStateProviderBinding(agent, state),
      resolveReceiptProviderBinding(receipt),
      agent.binaryName,
    )

    expect(persisted?.target.arguments).toBeUndefined()
    expect(persisted?.target.binaryName).toBe('demo')
  })

  it('keeps receipt preference when identities conflict', () => {
    const state: InstalledAgentState = {
      agentName: 'demo',
      installType: 'cargo',
      packageInstallArgs: ['--locked'],
      packageName: 'demo-crate',
    }
    const receipt: LifecycleReceipt = {
      executableName: 'demo',
      kind: 'lifecycle-receipt',
      providerId: 'npm',
      providerTargetId: 'demo-crate',
      providerTargetKind: 'package',
      schemaVersion: 1,
      targetId: 'demo',
      verifiedAt: '2026-07-30T00:00:00.000Z',
    }

    const persisted = resolvePersistedProviderBinding(
      resolveStateProviderBinding(agent, state),
      resolveReceiptProviderBinding(receipt),
      agent.binaryName,
    )

    expect(persisted).toEqual({
      providerId: 'npm',
      target: {
        binaryName: 'demo',
        id: 'demo-crate',
        kind: 'package',
      },
    })
  })
})
