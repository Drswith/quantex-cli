import type { AgentDefinition, InstallMethod } from '../../src/agents'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runInstallEnsureLifecycle, type InstallEnsureLifecycleDependencies } from '../../src/services/install-ensure'
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

const scriptMethod: InstallMethod = {
  command: 'curl https://example.com/install | bash',
  type: 'script',
}

function createInspection(
  overrides: Partial<{
    inPath: boolean
    installedState: {
      agentName: string
      installType: 'bun'
      packageName: string
    }
    methods: InstallMethod[]
  }> = {},
) {
  return {
    agent: testAgent,
    inspection: {
      agent: testAgent,
      inPath: overrides.inPath ?? false,
      installedState: overrides.installedState,
      lifecycle: overrides.installedState ? ('managed' as const) : ('unmanaged' as const),
      methods: overrides.methods ?? testAgent.platforms.macos!,
      sourceLabel: 'Unknown',
      updateLabel: 'Manual',
    },
  }
}

function createDependencies(): InstallEnsureLifecycleDependencies {
  return {
    getAdoptableExistingInstallMethod: vi.fn(),
    installAgent: vi.fn(),
    isResourceLockError: (error): error is ResourceLockError => error instanceof ResourceLockError,
    resolveAgentInspection: vi.fn(),
    trackInstalledAgent: vi.fn(),
  }
}

describe('runInstallEnsureLifecycle', () => {
  let dependencies: InstallEnsureLifecycleDependencies

  beforeEach(() => {
    dependencies = createDependencies()
  })

  it('returns agent-not-found without attempting a mutation', async () => {
    vi.mocked(dependencies.resolveAgentInspection).mockResolvedValue(undefined)

    const result = await runInstallEnsureLifecycle('missing-agent', { dryRun: false }, dependencies)

    expect(result).toEqual({
      input: 'missing-agent',
      kind: 'agent-not-found',
    })
    expect(dependencies.installAgent).not.toHaveBeenCalled()
    expect(dependencies.trackInstalledAgent).not.toHaveBeenCalled()
  })

  it('returns already-installed for a managed existing install', async () => {
    vi.mocked(dependencies.resolveAgentInspection).mockResolvedValue(
      createInspection({
        inPath: true,
        installedState: {
          agentName: 'test-agent',
          installType: 'bun',
          packageName: 'test-pkg',
        },
      }),
    )

    const result = await runInstallEnsureLifecycle('test-agent', { dryRun: false }, dependencies)

    expect(result).toEqual({
      agent: testAgent,
      kind: 'already-installed',
    })
    expect(dependencies.installAgent).not.toHaveBeenCalled()
    expect(dependencies.trackInstalledAgent).not.toHaveBeenCalled()
  })

  it('returns would-track-existing for an adoptable dry run', async () => {
    vi.mocked(dependencies.resolveAgentInspection).mockResolvedValue(
      createInspection({
        inPath: true,
        methods: [scriptMethod],
      }),
    )
    vi.mocked(dependencies.getAdoptableExistingInstallMethod).mockReturnValue(scriptMethod)
    const onMutationStart = vi.fn()

    const result = await runInstallEnsureLifecycle('test-agent', { dryRun: true, onMutationStart }, dependencies)

    expect(result).toEqual({
      agent: testAgent,
      kind: 'would-track-existing',
    })
    expect(onMutationStart).not.toHaveBeenCalled()
    expect(dependencies.trackInstalledAgent).not.toHaveBeenCalled()
  })

  it('tracks an adoptable existing install after announcing the mutation', async () => {
    vi.mocked(dependencies.resolveAgentInspection).mockResolvedValue(
      createInspection({
        inPath: true,
        methods: [scriptMethod],
      }),
    )
    vi.mocked(dependencies.getAdoptableExistingInstallMethod).mockReturnValue(scriptMethod)
    vi.mocked(dependencies.trackInstalledAgent).mockResolvedValue({
      agentName: 'test-agent',
      command: scriptMethod.command,
      installType: 'script',
    })
    const onMutationStart = vi.fn()

    const result = await runInstallEnsureLifecycle('test-agent', { dryRun: false, onMutationStart }, dependencies)

    expect(onMutationStart).toHaveBeenCalledWith(testAgent)
    expect(dependencies.trackInstalledAgent).toHaveBeenCalledWith(testAgent, scriptMethod)
    expect(result).toMatchObject({
      agent: testAgent,
      installedState: {
        agentName: 'test-agent',
        installType: 'script',
      },
      kind: 'tracked-existing',
    })
  })

  it('returns tracking-cancelled when adopted state is not persisted', async () => {
    vi.mocked(dependencies.resolveAgentInspection).mockResolvedValue(
      createInspection({
        inPath: true,
        methods: [scriptMethod],
      }),
    )
    vi.mocked(dependencies.getAdoptableExistingInstallMethod).mockReturnValue(scriptMethod)
    vi.mocked(dependencies.trackInstalledAgent).mockResolvedValue(null)

    const result = await runInstallEnsureLifecycle('test-agent', { dryRun: false }, dependencies)

    expect(result).toEqual({
      agent: testAgent,
      kind: 'tracking-cancelled',
    })
  })

  it('returns untracked-existing when no install source is safely adoptable', async () => {
    vi.mocked(dependencies.resolveAgentInspection).mockResolvedValue(
      createInspection({
        inPath: true,
      }),
    )
    vi.mocked(dependencies.getAdoptableExistingInstallMethod).mockReturnValue(undefined)

    const result = await runInstallEnsureLifecycle('test-agent', { dryRun: false }, dependencies)

    expect(result).toEqual({
      agent: testAgent,
      kind: 'untracked-existing',
    })
    expect(dependencies.installAgent).not.toHaveBeenCalled()
  })

  it('returns would-install for a missing agent dry run', async () => {
    vi.mocked(dependencies.resolveAgentInspection).mockResolvedValue(createInspection())

    const result = await runInstallEnsureLifecycle('test-agent', { dryRun: true }, dependencies)

    expect(result).toEqual({
      agent: testAgent,
      kind: 'would-install',
    })
    expect(dependencies.installAgent).not.toHaveBeenCalled()
  })

  it('returns installed with persisted install state after installation succeeds', async () => {
    vi.mocked(dependencies.resolveAgentInspection).mockResolvedValue(createInspection())
    vi.mocked(dependencies.installAgent).mockResolvedValue({
      installedState: {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
      },
      success: true,
    })
    const onMutationStart = vi.fn()

    const result = await runInstallEnsureLifecycle('test-agent', { dryRun: false, onMutationStart }, dependencies)

    expect(onMutationStart).toHaveBeenCalledWith(testAgent)
    expect(result).toMatchObject({
      agent: testAgent,
      installedState: {
        installType: 'bun',
        packageName: 'test-pkg',
      },
      kind: 'installed',
    })
  })

  it('returns install-failed when installation reports failure', async () => {
    vi.mocked(dependencies.resolveAgentInspection).mockResolvedValue(createInspection())
    vi.mocked(dependencies.installAgent).mockResolvedValue({ success: false })

    const result = await runInstallEnsureLifecycle('test-agent', { dryRun: false }, dependencies)

    expect(result).toEqual({
      agent: testAgent,
      kind: 'install-failed',
    })
  })

  it.each([
    {
      expectedInstalled: true,
      inPath: true,
      operation: 'track',
    },
    {
      expectedInstalled: false,
      inPath: false,
      operation: 'install',
    },
  ])('returns resource-locked when $operation cannot acquire the lock', async ({ expectedInstalled, inPath }) => {
    const error = new ResourceLockError('agent lifecycle', '/tmp/agent-lifecycle.lock')
    vi.mocked(dependencies.resolveAgentInspection).mockResolvedValue(
      createInspection({
        inPath,
        methods: [scriptMethod],
      }),
    )
    vi.mocked(dependencies.getAdoptableExistingInstallMethod).mockReturnValue(scriptMethod)

    if (inPath) vi.mocked(dependencies.trackInstalledAgent).mockRejectedValue(error)
    else vi.mocked(dependencies.installAgent).mockRejectedValue(error)

    const result = await runInstallEnsureLifecycle('test-agent', { dryRun: false }, dependencies)

    expect(result).toEqual({
      agent: testAgent,
      error,
      installed: expectedInstalled,
      kind: 'resource-locked',
    })
  })

  it('propagates unexpected installation errors', async () => {
    const error = new Error('unexpected')
    vi.mocked(dependencies.resolveAgentInspection).mockResolvedValue(createInspection())
    vi.mocked(dependencies.installAgent).mockRejectedValue(error)

    await expect(runInstallEnsureLifecycle('test-agent', { dryRun: false }, dependencies)).rejects.toBe(error)
  })
})
