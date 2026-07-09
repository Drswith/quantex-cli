import type { AgentDefinition } from '../../src/agents'
import type { AgentInspection } from '../../src/inspection'
import type { PendingAgentUpdate, PlannedAgentUpdates } from '../../src/services/update'
import type { InstalledAgentState } from '../../src/state'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  executePlannedUpdates,
  type UpdateExecutionDependencies,
  type UpdateResultItem,
} from '../../src/services/update-execution'
import { ResourceLockError } from '../../src/utils/lock'

const testAgent: AgentDefinition = {
  binaryName: 'test-bin',
  displayName: 'Test Agent',
  homepage: 'https://example.com/test-agent',
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

function createAgent(name: string, overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    ...testAgent,
    binaryName: `${name}-bin`,
    displayName: name,
    name,
    ...overrides,
  }
}

function createInspection(agent: AgentDefinition, overrides: Partial<AgentInspection> = {}): AgentInspection {
  return {
    agent,
    inPath: true,
    installedVersion: '1.0.0',
    latestVersion: '2.0.0',
    lifecycle: 'managed',
    methods: agent.platforms.macos ?? [],
    sourceLabel: 'Bun',
    updateLabel: 'Managed',
    ...overrides,
  }
}

function createPendingUpdate(agent: AgentDefinition, overrides: Partial<PendingAgentUpdate> = {}): PendingAgentUpdate {
  const inspection = createInspection(agent)
  return {
    agent,
    inspection,
    installerType: 'bun',
    package: {
      packageName: agent.packages?.npm ?? `${agent.name}-pkg`,
    },
    strategy: 'managed',
    ...overrides,
  }
}

function createPlan(overrides: Partial<PlannedAgentUpdates> = {}): PlannedAgentUpdates {
  return {
    entries: [],
    grouped: [],
    manual: [],
    skippedManualCheck: [],
    untrackedInPath: [],
    upToDate: [],
    ...overrides,
  }
}

function createDependencies(): UpdateExecutionDependencies {
  return {
    canAutoUpdateAgent: vi.fn(() => true),
    getAgentUpdateFailureHint: vi.fn(() => undefined),
    getAgentUpdateStrategy: vi.fn(() => 'managed' as const),
    getInstalledVersion: vi.fn(async () => undefined),
    getManualAgentUpdateMessage: vi.fn(agent => `manual:${agent.name}`),
    getUntrackedPathAgentUpdateMessage: vi.fn(agent => `untracked:${agent.name}`),
    isResourceLockError: (error): error is ResourceLockError => error instanceof ResourceLockError,
    updateAgent: vi.fn(async () => ({ success: true })),
    updateAgentsByType: vi.fn(async () => true),
  }
}

describe('executePlannedUpdates', () => {
  let dependencies: UpdateExecutionDependencies

  beforeEach(() => {
    dependencies = createDependencies()
  })

  it('reports initial classifications in their existing order', async () => {
    const upToDate = createAgent('up-to-date')
    const skipped = createAgent('skipped')
    const untracked = createAgent('untracked')
    const progress: UpdateResultItem[] = []

    const result = await executePlannedUpdates(
      createPlan({
        skippedManualCheck: [createInspection(skipped)],
        untrackedInPath: [createInspection(untracked)],
        upToDate: [createInspection(upToDate, { latestVersion: '1.0.0' })],
      }),
      {
        dryRun: false,
        isCancelled: () => false,
        onProgress: item => progress.push(item),
      },
      dependencies,
    )

    expect(result).toEqual({
      hasFailures: false,
      results: [
        {
          displayName: 'up-to-date',
          installedVersion: '1.0.0',
          latestVersion: '1.0.0',
          name: 'up-to-date',
          status: 'up-to-date',
        },
        {
          displayName: 'skipped',
          message: 'manual:skipped',
          name: 'skipped',
          status: 'manual-required',
        },
        {
          displayName: 'untracked',
          message: 'untracked:untracked',
          name: 'untracked',
          status: 'manual-required',
        },
      ],
    })
    expect(progress).toEqual(result.results)
  })

  it('executes a managed group once and reports every entry', async () => {
    const first = createPendingUpdate(createAgent('first'))
    const second = createPendingUpdate(createAgent('second'))

    const result = await executePlannedUpdates(
      createPlan({
        grouped: [
          {
            packages: [first.package!, second.package!],
            type: 'bun',
            updates: [first, second],
          },
        ],
      }),
      { dryRun: false, isCancelled: () => false },
      dependencies,
    )

    expect(dependencies.updateAgentsByType).toHaveBeenCalledWith('bun', [first.package, second.package])
    expect(dependencies.updateAgent).not.toHaveBeenCalled()
    expect(result.results.map(item => item.status)).toEqual(['updated', 'updated'])
  })

  it('falls back to sequential per-agent updates when grouped execution reports failure', async () => {
    const first = createPendingUpdate(createAgent('first'))
    const second = createPendingUpdate(createAgent('second'))
    vi.mocked(dependencies.updateAgentsByType).mockResolvedValue(false)

    const result = await executePlannedUpdates(
      createPlan({
        grouped: [
          {
            packages: [first.package!, second.package!],
            type: 'bun',
            updates: [first, second],
          },
        ],
      }),
      { dryRun: false, isCancelled: () => false },
      dependencies,
    )

    expect(dependencies.updateAgent).toHaveBeenNthCalledWith(1, first.agent, undefined)
    expect(dependencies.updateAgent).toHaveBeenNthCalledWith(2, second.agent, undefined)
    expect(result.results.map(item => item.status)).toEqual(['updated', 'updated'])
  })

  it('returns planned results without invoking mutations during dry-run', async () => {
    const grouped = createPendingUpdate(createAgent('grouped'))
    const manual = createPendingUpdate(createAgent('manual'))

    const result = await executePlannedUpdates(
      createPlan({
        grouped: [
          {
            packages: [grouped.package!],
            type: 'bun',
            updates: [grouped],
          },
        ],
        manual: [manual],
      }),
      { dryRun: true, isCancelled: () => false },
      dependencies,
    )

    expect(dependencies.updateAgentsByType).not.toHaveBeenCalled()
    expect(dependencies.updateAgent).not.toHaveBeenCalled()
    expect(result.results.map(item => item.status)).toEqual(['planned', 'planned'])
  })

  it('stops before later groups and manual entries after cancellation', async () => {
    const first = createPendingUpdate(createAgent('first'))
    const second = createPendingUpdate(createAgent('second'), {
      installerType: 'npm',
      package: { packageName: 'second-pkg' },
    })
    const manual = createPendingUpdate(createAgent('manual'))
    let cancelled = false

    const result = await executePlannedUpdates(
      createPlan({
        grouped: [
          {
            packages: [first.package!],
            type: 'bun',
            updates: [first],
          },
          {
            packages: [second.package!],
            type: 'npm',
            updates: [second],
          },
        ],
        manual: [manual],
      }),
      {
        dryRun: false,
        isCancelled: () => cancelled,
        onProgress: () => {
          cancelled = true
        },
      },
      dependencies,
    )

    expect(dependencies.updateAgentsByType).toHaveBeenCalledTimes(1)
    expect(dependencies.updateAgentsByType).toHaveBeenCalledWith('bun', [first.package])
    expect(dependencies.updateAgent).not.toHaveBeenCalled()
    expect(result.results.map(item => item.name)).toEqual(['first'])
  })

  it('preserves lifecycle lock details for individual updates', async () => {
    const error = new ResourceLockError('agent lifecycle', '/tmp/agent-lifecycle.lock')
    const update = createPendingUpdate(testAgent, {
      state: {
        agentName: testAgent.name,
        command: 'test-bin update',
        installType: 'script',
      } satisfies InstalledAgentState,
      strategy: 'self-update',
    })
    vi.mocked(dependencies.getAgentUpdateStrategy).mockReturnValue('self-update')
    vi.mocked(dependencies.updateAgent).mockRejectedValue(error)

    const result = await executePlannedUpdates(
      createPlan({ manual: [update] }),
      { dryRun: false, isCancelled: () => false },
      dependencies,
    )

    expect(result).toEqual({
      hasFailures: true,
      results: [
        {
          displayName: 'Test Agent',
          installedVersion: '1.0.0',
          latestVersion: '2.0.0',
          message: error.message,
          name: 'test-agent',
          resource: 'agent lifecycle',
          status: 'locked',
          strategy: 'self-update',
        },
      ],
    })
  })

  it.each([
    {
      expected: {
        installedVersion: '1.0.0',
        latestVersion: '1.0.0',
        status: 'up-to-date',
      },
      verifiedVersion: '1.0.0',
    },
    {
      expected: {
        installedVersion: '1.0.0',
        latestVersion: '2.0.0',
        status: 'updated',
      },
      verifiedVersion: '2.0.0',
    },
  ] as const)('classifies a verified self-update as $expected.status', async ({ expected, verifiedVersion }) => {
    const agent = createAgent('self-updating', {
      selfUpdate: {
        command: ['self-updating-bin', 'update'],
      },
    })
    const update = createPendingUpdate(agent, {
      strategy: 'self-update',
    })
    vi.mocked(dependencies.getAgentUpdateStrategy).mockReturnValue('self-update')
    vi.mocked(dependencies.getInstalledVersion).mockResolvedValue(verifiedVersion)

    const result = await executePlannedUpdates(
      createPlan({ manual: [update] }),
      { dryRun: false, isCancelled: () => false },
      dependencies,
    )

    expect(dependencies.getInstalledVersion).toHaveBeenCalledWith(agent.binaryName, agent.versionProbe)
    expect(result.results[0]).toMatchObject(expected)
  })
})
