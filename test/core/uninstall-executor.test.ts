import type { CoreUninstallExecutorPorts } from '../../src/core/uninstall-executor'
import { describe, expect, it, vi } from 'vitest'
import { executeCoreUninstall } from '../../src/core/uninstall-executor'
import { ResourceLockError } from '../../src/utils/lock'

const agent = {
  binaryName: 'fixture-bin',
  displayName: 'Fixture',
  homepage: 'https://example.com',
  name: 'fixture',
  platforms: {},
}

describe('Core uninstall executor', () => {
  it('reports unknown agents without mutating state', async () => {
    const ports = createPorts({ resolveAgent: () => undefined })
    const outcome = await executeCoreUninstall({ name: 'missing' }, ports)
    expect(outcome).toMatchObject({ kind: 'agent-not-found', name: 'missing' })
    expect(ports.removeInstalledState).not.toHaveBeenCalled()
  })

  it('reports unmanaged targets when no state or receipt exists', async () => {
    const ports = createPorts()
    const outcome = await executeCoreUninstall({ name: 'fixture' }, ports)
    expect(outcome).toMatchObject({ kind: 'unmanaged', name: 'fixture' })
    expect(ports.uninstallInstalled).not.toHaveBeenCalled()
  })

  it('returns dry-run without provider uninstall', async () => {
    const ports = createPorts({
      dryRun: true,
      readInstalledState: vi.fn(async () => ({
        agentName: 'fixture',
        installType: 'npm' as const,
        packageName: 'fixture-pkg',
      })),
      readReceipt: vi.fn(async () => ({
        executableName: 'fixture-bin',
        kind: 'lifecycle-receipt' as const,
        providerId: 'npm',
        providerTargetId: 'fixture-pkg',
        providerTargetKind: 'package' as const,
        schemaVersion: 1,
        targetId: 'fixture',
        verifiedAt: '2026-09-02T00:00:00.000Z',
      })),
      isBinaryInPath: vi.fn(async () => true),
    })
    const outcome = await executeCoreUninstall({ name: 'fixture' }, ports)
    expect(outcome).toMatchObject({ kind: 'dry-run' })
    expect(ports.uninstallInstalled).not.toHaveBeenCalled()
  })

  it('surfaces lock failures without falling through', async () => {
    const lock = new ResourceLockError('busy', 'agent lifecycle')
    const ports = createPorts({
      withMutationLock: vi.fn(async () => {
        throw lock
      }),
    })
    const outcome = await executeCoreUninstall({ name: 'fixture' }, ports)
    expect(outcome).toMatchObject({ kind: 'locked', lock })
  })
})

function createPorts(overrides: Partial<CoreUninstallExecutorPorts> = {}): CoreUninstallExecutorPorts {
  return {
    dryRun: false,
    isBinaryInPath: vi.fn(async () => false),
    isCancelled: () => false,
    observeProvider: vi.fn(async binding => ({
      kind: 'success' as const,
      value: { kind: 'present' as const, target: binding.target },
    })),
    readInstalledState: vi.fn(async () => undefined),
    readReceipt: vi.fn(async () => undefined),
    removeInstalledState: vi.fn(async () => undefined),
    removeReceipt: vi.fn(async () => undefined),
    resolveAgent: vi.fn(() => agent),
    setInstalledState: vi.fn(async () => undefined),
    setReceipt: vi.fn(async () => undefined),
    uninstallInstalled: vi.fn(async () => ({ kind: 'success' as const, value: {} })),
    withMutationLock: vi.fn(async run => run()),
    ...overrides,
  }
}
