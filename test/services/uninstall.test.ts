import type { AgentDefinition } from '../../src/agents'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runUninstallLifecycle, type UninstallLifecycleDependencies } from '../../src/services/uninstall'
import { ResourceLockError } from '../../src/utils/lock'

const testAgent: AgentDefinition = {
  binaryName: 'test-bin',
  displayName: 'Test Agent',
  homepage: 'https://example.com',
  name: 'test-agent',
  packages: {
    npm: 'test-pkg',
  },
  platforms: {
    linux: [{ type: 'bun' }],
    macos: [{ type: 'bun' }],
    windows: [{ type: 'bun' }],
  },
}

function createDependencies(): UninstallLifecycleDependencies {
  return {
    getInstalledAgentState: vi.fn(),
    isResourceLockError: (error): error is ResourceLockError => error instanceof ResourceLockError,
    resolveAgent: vi.fn(),
    uninstallAgent: vi.fn(),
  }
}

describe('runUninstallLifecycle', () => {
  let dependencies: UninstallLifecycleDependencies

  beforeEach(() => {
    dependencies = createDependencies()
  })

  it('returns agent-not-found without inspecting state', async () => {
    vi.mocked(dependencies.resolveAgent).mockReturnValue(undefined)

    const result = await runUninstallLifecycle('missing-agent', { dryRun: false }, dependencies)

    expect(result).toEqual({
      input: 'missing-agent',
      kind: 'agent-not-found',
    })
    expect(dependencies.getInstalledAgentState).not.toHaveBeenCalled()
  })

  it('returns unmanaged without invoking uninstall', async () => {
    vi.mocked(dependencies.resolveAgent).mockReturnValue(testAgent)
    vi.mocked(dependencies.getInstalledAgentState).mockResolvedValue(undefined)

    const result = await runUninstallLifecycle('test-agent', { dryRun: false }, dependencies)

    expect(result).toEqual({
      agent: testAgent,
      input: 'test-agent',
      kind: 'unmanaged',
    })
    expect(dependencies.uninstallAgent).not.toHaveBeenCalled()
  })

  it('returns would-uninstall for a managed dry run', async () => {
    vi.mocked(dependencies.resolveAgent).mockReturnValue(testAgent)
    vi.mocked(dependencies.getInstalledAgentState).mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })

    const result = await runUninstallLifecycle('test-agent', { dryRun: true }, dependencies)

    expect(result).toEqual({
      agent: testAgent,
      kind: 'would-uninstall',
    })
    expect(dependencies.uninstallAgent).not.toHaveBeenCalled()
  })

  it.each([
    {
      kind: 'uninstalled',
      success: true,
    },
    {
      kind: 'uninstall-failed',
      success: false,
    },
  ] as const)('returns $kind when package-manager success is $success', async ({ kind, success }) => {
    vi.mocked(dependencies.resolveAgent).mockReturnValue(testAgent)
    vi.mocked(dependencies.getInstalledAgentState).mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })
    vi.mocked(dependencies.uninstallAgent).mockResolvedValue(success)

    const result = await runUninstallLifecycle('test-agent', { dryRun: false }, dependencies)

    expect(result).toEqual({
      agent: testAgent,
      kind,
    })
  })

  it('returns resource-locked with the original error', async () => {
    const error = new ResourceLockError('agent lifecycle', '/tmp/agent-lifecycle.lock')
    vi.mocked(dependencies.resolveAgent).mockReturnValue(testAgent)
    vi.mocked(dependencies.getInstalledAgentState).mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })
    vi.mocked(dependencies.uninstallAgent).mockRejectedValue(error)

    const result = await runUninstallLifecycle('test-agent', { dryRun: false }, dependencies)

    expect(result).toEqual({
      agent: testAgent,
      error,
      kind: 'resource-locked',
    })
  })

  it('propagates unexpected uninstall errors', async () => {
    const error = new Error('unexpected')
    vi.mocked(dependencies.resolveAgent).mockReturnValue(testAgent)
    vi.mocked(dependencies.getInstalledAgentState).mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })
    vi.mocked(dependencies.uninstallAgent).mockRejectedValue(error)

    await expect(runUninstallLifecycle('test-agent', { dryRun: false }, dependencies)).rejects.toBe(error)
  })
})
