import type { AgentDefinition } from '../../src/agents'
import type { ManagedInstallType } from '../../src/package-manager'
import type { ProviderId } from '../../src/providers'
import type { RunSingleAgentLifecycleUpdateOutcome } from '../../src/services/lifecycle-updates-production'
import type { InstalledAgentState } from '../../src/state'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { cancelCliContextOperations, resetCliContext, setCliContext } from '../../src/cli-context'
import { executeCommandWithRuntime } from '../../src/command-runtime'
import { createUpdateCommandInvocation, updateCommand } from '../../src/commands/update'
import * as pm from '../../src/package-manager'
import * as lifecycleUpdateProduction from '../../src/services/lifecycle-updates-production'
import * as state from '../../src/state'
import * as detect from '../../src/utils/detect'
import { ResourceLockError } from '../../src/utils/lock'
import * as version from '../../src/utils/version'

const agentSpy = vi.spyOn(agents, 'getAgentByNameOrAlias')
const allAgentsSpy = vi.spyOn(agents, 'getAllAgents')
const updateSpy = vi.spyOn(pm, 'updateAgent')
const updateAgentsByTypeSpy = vi.spyOn(pm, 'updateAgentsByType')
const managedInstalledVersionSpy = vi.spyOn(pm, 'getManagedInstalledPackageVersion')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')
const installedVerSpy = vi.spyOn(version, 'getInstalledVersion')
const latestVerSpy = vi.spyOn(version, 'getLatestVersion')
const installedStateSpy = vi.spyOn(state, 'getInstalledAgentState')
const runSingleAgentLifecycleUpdate = lifecycleUpdateProduction.runSingleAgentLifecycleUpdate
const lifecycleUpdateSpy = vi.spyOn(lifecycleUpdateProduction, 'runSingleAgentLifecycleUpdate')

afterAll(() => {
  agentSpy.mockRestore()
  allAgentsSpy.mockRestore()
  updateSpy.mockRestore()
  updateAgentsByTypeSpy.mockRestore()
  managedInstalledVersionSpy.mockRestore()
  binaryInPathSpy.mockRestore()
  installedVerSpy.mockRestore()
  latestVerSpy.mockRestore()
  installedStateSpy.mockRestore()
  lifecycleUpdateSpy.mockRestore()
})

const testAgent = {
  name: 'test-agent',
  lookupAliases: ['ta'],
  displayName: 'Test Agent',
  homepage: 'https://example.com',
  packages: { npm: 'test-pkg' },
  binaryName: 'test-bin',
  platforms: {
    linux: [{ type: 'bun' as const }],
    macos: [{ type: 'bun' as const }],
    windows: [{ type: 'bun' as const }],
  },
}

describe('updateCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetCliContext()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    agentSpy.mockClear()
    allAgentsSpy.mockClear()
    updateSpy.mockClear()
    updateAgentsByTypeSpy.mockClear()
    managedInstalledVersionSpy.mockClear()
    managedInstalledVersionSpy.mockResolvedValue(undefined)
    binaryInPathSpy.mockClear()
    installedVerSpy.mockClear()
    latestVerSpy.mockClear()
    installedStateSpy.mockClear()
    lifecycleUpdateSpy.mockReset().mockImplementation(runSingleAgentLifecycleUpdate)
  })

  afterEach(() => {
    resetCliContext()
    logSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
  })

  it('shows error for unknown agent', async () => {
    agentSpy.mockReturnValue(undefined)
    await updateCommand('unknown', false)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
  })

  it('shows up to date when versions match', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('1.0.0')
    mockSingleLifecycleOutcome({ decision: 'up-to-date', installedVersion: '1.0.0', latestVersion: '1.0.0' })
    await updateCommand('test-agent', false)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('up to date'))
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('updates and shows success when version differs', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockResolvedValue(undefined)
    updateAgentsByTypeSpy.mockResolvedValue(true)
    updateSpy.mockResolvedValue({ success: true })
    mockSingleLifecycleOutcome({
      decision: 'upgrade',
      installedVersion: '1.0.0',
      kind: 'updated',
      latestVersion: '2.0.0',
    })
    await updateCommand('test-agent', false)
    expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining('Updating Test Agent via managed/bun... (1.0.0 -> 2.0.0)'),
    )
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('updated successfully'))
  })

  it('shares one prepared lifecycle invocation between the single update policy and command run', async () => {
    agentSpy.mockReturnValue(testAgent)
    const target = createBatchCommandTarget('test-agent', 'updated', 'upgrade', testAgent)
    const outcome = target.result.execution as RunSingleAgentLifecycleUpdateOutcome
    const lifecycleInvocation = {
      dispose: vi.fn(),
      getOutcome: vi.fn(() => outcome),
      observe: vi.fn(async () => (outcome.kind === 'updated' ? outcome.after : undefined)),
      prepare: vi.fn(async () => target.target.outcome),
      run: vi.fn(async () => outcome),
    }
    const createInvocationSpy = vi
      .spyOn(lifecycleUpdateProduction, 'createSingleAgentLifecycleUpdateInvocation')
      .mockReturnValue(lifecycleInvocation as never)

    try {
      const invocation = createUpdateCommandInvocation('ta', false)
      const policy = await invocation.idempotencyPolicy?.()
      const result = await invocation.run()
      invocation.dispose()

      expect(policy?.request).toEqual({
        action: 'update',
        options: { requestedVersion: 'latest', scope: 'single' },
        targets: ['test-agent'],
      })
      expect(createInvocationSpy).toHaveBeenCalledWith('ta')
      expect(lifecycleInvocation.prepare).toHaveBeenCalledOnce()
      expect(lifecycleInvocation.run).toHaveBeenCalledOnce()
      expect(lifecycleInvocation.dispose).toHaveBeenCalledOnce()
      expect(lifecycleUpdateSpy).not.toHaveBeenCalled()
      expect(result.ok).toBe(true)
    } finally {
      createInvocationSpy.mockRestore()
    }
  })

  it('maps provider success with a stale postcondition to UPDATE_FAILED', async () => {
    agentSpy.mockReturnValue(testAgent)
    lifecycleUpdateSpy.mockResolvedValue({
      kind: 'verification-failed',
      plan: {
        before: {
          agent: testAgent,
          binding: { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
          capabilities: ['observe', 'resolve-latest-version', 'update', 'verify'],
          executable: { present: true, version: '1.0.0' },
          installedState: { agentName: 'test-agent', installType: 'bun', packageName: 'test-pkg' },
          methods: [{ type: 'bun' }],
          observation: {
            drift: { kind: 'none' },
            kind: 'present',
            providerId: 'bun',
            providerTargetId: 'test-pkg',
            providerTargetKind: 'package',
            targetId: 'test-agent',
            version: '1.0.0',
          },
        },
        binding: { providerId: 'bun', target: { id: 'test-pkg', kind: 'package' } },
        plannedTargetVersion: '2.0.0',
        planning: {
          decision: 'upgrade',
          plan: {
            id: 'update-test-agent',
            intent: { kind: 'update', targetId: 'test-agent', targetVersion: '2.0.0' },
            kind: 'lifecycle-plan',
            observation: {
              drift: { kind: 'none' },
              kind: 'present',
              providerId: 'bun',
              providerTargetId: 'test-pkg',
              providerTargetKind: 'package',
              targetId: 'test-agent',
              version: '1.0.0',
            },
            steps: [],
          },
        },
      },
      providerOutcome: {
        kind: 'success',
        value: { evidence: [], target: { id: 'test-pkg', kind: 'package' } },
      },
      verification: {
        kind: 'unsatisfied',
        observation: {
          drift: { kind: 'none' },
          kind: 'present',
          providerId: 'bun',
          providerTargetId: 'test-pkg',
          providerTargetKind: 'package',
          targetId: 'test-agent',
          version: '1.0.0',
        },
        postcondition: { expectedVersion: '2.0.0', kind: 'version-satisfies', targetId: 'test-pkg' },
        reason: 'Observed version 1.0.0 does not satisfy target 2.0.0.',
      },
    })

    const result = await updateCommand('test-agent', false)

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('UPDATE_FAILED')
    expect(result.data?.results).toEqual([
      expect.objectContaining({ installedVersion: '1.0.0', latestVersion: '2.0.0', status: 'failed' }),
    ])
  })

  it('does not automatically update pip-managed agents without a target version', async () => {
    const pipAgent = {
      ...testAgent,
      name: 'pip-agent',
      binaryName: 'pip-bin',
      displayName: 'Pip Agent',
      packages: { pip: 'pip-pkg' },
      platforms: {
        linux: [{ type: 'pip' as const, packageName: 'pip-pkg' }],
        macos: [{ type: 'pip' as const, packageName: 'pip-pkg' }],
        windows: [{ type: 'pip' as const, packageName: 'pip-pkg' }],
      },
    }

    agentSpy.mockReturnValue(pipAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue({
      agentName: 'pip-agent',
      installType: 'pip',
      packageName: 'pip-pkg',
    })
    updateAgentsByTypeSpy.mockResolvedValue(true)
    updateSpy.mockResolvedValue({ success: true })
    mockSingleLifecycleOutcome({ decision: 'manual-required', installedVersion: '1.0.0' })
    await updateCommand('pip-agent', false)
    expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Pip Agent: manual action required.'))
  })

  it('does not automatically update uv-managed agents without a target version', async () => {
    const uvAgent = {
      ...testAgent,
      name: 'uv-agent',
      binaryName: 'uv-bin',
      displayName: 'Uv Agent',
      packages: { uv: 'uv-pkg' },
      platforms: {
        linux: [{ packageInstallArgs: ['--python', '3.12'], type: 'uv' as const }],
        macos: [{ packageInstallArgs: ['--python', '3.12'], type: 'uv' as const }],
        windows: [{ packageInstallArgs: ['--python', '3.12'], type: 'uv' as const }],
      },
    }

    agentSpy.mockReturnValue(uvAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue({
      agentName: 'uv-agent',
      installType: 'uv',
      packageInstallArgs: ['--python', '3.12'],
      packageName: 'uv-pkg',
    })
    updateAgentsByTypeSpy.mockResolvedValue(true)
    updateSpy.mockResolvedValue({ success: true })
    mockSingleLifecycleOutcome({ decision: 'manual-required', installedVersion: '1.0.0', providerId: 'uv' })
    await updateCommand('uv-agent', false)
    expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Uv Agent: manual action required.'))
  })

  it('does not automatically update deno-managed agents without a target version', async () => {
    const denoAgent = {
      ...testAgent,
      name: 'deno-agent',
      binaryName: 'deno-bin',
      displayName: 'Deno Agent',
      packages: { deno: 'jsr:@scope/deno-agent' },
      platforms: {
        linux: [{ packageInstallArgs: ['--allow-net'], type: 'deno' as const }],
        macos: [{ packageInstallArgs: ['--allow-net'], type: 'deno' as const }],
        windows: [{ packageInstallArgs: ['--allow-net'], type: 'deno' as const }],
      },
    }

    agentSpy.mockReturnValue(denoAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue({
      agentName: 'deno-agent',
      binaryName: 'deno-bin',
      installType: 'deno',
      packageInstallArgs: ['--allow-net'],
      packageName: 'jsr:@scope/deno-agent',
    })
    updateAgentsByTypeSpy.mockResolvedValue(true)
    updateSpy.mockResolvedValue({ success: true })
    mockSingleLifecycleOutcome({ decision: 'manual-required', installedVersion: '1.0.0', providerId: 'deno' })
    await updateCommand('deno-agent', false)
    expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Deno Agent: manual action required.'))
  })

  it('does not update tracked script installs through a candidate pip method', async () => {
    const scriptAndPipAgent = {
      ...testAgent,
      name: 'script-pip-agent',
      binaryName: 'script-pip-bin',
      displayName: 'Script Pip Agent',
      packages: { pip: 'script-pip-pkg' },
      platforms: {
        linux: [
          { command: 'curl https://example.com/install | bash', type: 'script' as const },
          { packageName: 'script-pip-pkg', type: 'pip' as const },
        ],
        macos: [
          { command: 'curl https://example.com/install | bash', type: 'script' as const },
          { packageName: 'script-pip-pkg', type: 'pip' as const },
        ],
        windows: [{ packageName: 'script-pip-pkg', type: 'pip' as const }],
      },
    }

    agentSpy.mockReturnValue(scriptAndPipAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue({
      agentName: 'script-pip-agent',
      command: 'curl https://example.com/install | bash',
      installType: 'script',
    })
    updateAgentsByTypeSpy.mockResolvedValue(true)
    updateSpy.mockResolvedValue({ success: true })
    mockSingleLifecycleOutcome({ decision: 'manual-required', installedVersion: '1.0.0', providerId: 'script' })

    await updateCommand('script-pip-agent', false)

    expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Script Pip Agent: manual action required.')
    expect(output).toContain('manually managed install source')
  })

  it('routes update --all through the lifecycle batch root without legacy package-manager batching', async () => {
    const batchRoot = requireLifecycleBatchRoot()
    const batchSpy = vi.spyOn(lifecycleUpdateProduction, batchRoot).mockResolvedValue({
      cancellationRemainder: [],
      kind: 'lifecycle-update-batch-outcome',
      plan: {
        id: 'empty',
        kind: 'lifecycle-update-batch-plan',
        providerBuckets: [],
        resolvedPlanId: 'empty',
        targets: [],
      },
      results: [],
      success: true,
    } as never)

    try {
      const result = await updateCommand(undefined, true)

      expect(result.ok).toBe(true)
      expect(batchSpy).toHaveBeenCalledOnce()
      expect(lifecycleUpdateSpy).not.toHaveBeenCalled()
      expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
      expect(updateSpy).not.toHaveBeenCalled()
    } finally {
      batchSpy.mockRestore()
    }
  })

  it('shares one prepared batch invocation between the update-all policy and command run', async () => {
    mockBatchCommandAgents(['alpha', 'beta'])
    const alpha = createBatchCommandTarget('alpha', 'updated')
    const beta = createBatchCommandTarget('beta', 'updated')
    const plan = createBatchCommandPlan([alpha.target, beta.target])
    const outcome = {
      cancellationRemainder: [],
      kind: 'lifecycle-update-batch-outcome' as const,
      plan,
      results: [alpha.result, beta.result],
      success: true,
    }
    const lifecycleInvocation = {
      dispose: vi.fn(),
      getOutcome: vi.fn(() => outcome),
      observe: vi.fn(),
      prepare: vi.fn(async () => plan),
      run: vi.fn(async () => outcome),
    }
    const createInvocationSpy = vi
      .spyOn(lifecycleUpdateProduction, 'createLifecycleUpdateBatchInvocation')
      .mockReturnValue(lifecycleInvocation as never)

    try {
      const invocation = createUpdateCommandInvocation(undefined, true)
      const policy = await invocation.idempotencyPolicy?.()
      const result = await invocation.run()
      invocation.dispose()

      expect(policy?.request).toEqual({
        action: 'update',
        options: { requestedVersion: 'latest', scope: 'all' },
        targets: ['alpha', 'beta'],
      })
      expect(lifecycleInvocation.prepare).toHaveBeenCalledOnce()
      expect(lifecycleInvocation.run).toHaveBeenCalledOnce()
      expect(lifecycleInvocation.dispose).toHaveBeenCalledOnce()
      expect(result.ok).toBe(true)
    } finally {
      createInvocationSpy.mockRestore()
    }
  })

  it('projects mixed batch outcomes and progress events in canonical target order', async () => {
    setCliContext({ interactive: false, outputMode: 'ndjson', runId: 'batch-canonical-run' })
    mockBatchCommandAgents(['alpha', 'beta', 'gamma', 'zeta'])
    const alpha = createBatchCommandTarget('alpha', 'updated')
    const beta = createBatchCommandPlanningFailure('beta')
    const gamma = createBatchCommandTarget('gamma', 'not-executed', 'manual-required')
    const zeta = createBatchCommandTarget('zeta', 'locked')
    const batchRoot = requireLifecycleBatchRoot()
    const batchSpy = vi.spyOn(lifecycleUpdateProduction, batchRoot).mockResolvedValue({
      cancellationRemainder: [],
      kind: 'lifecycle-update-batch-outcome',
      plan: createBatchCommandPlan([alpha.target, beta.target, gamma.target, zeta.target]),
      results: [alpha.result, beta.result, gamma.result, zeta.result],
      success: false,
    } as never)

    try {
      const result = await updateCommand(undefined, true)
      const events = logSpy.mock.calls.map((call: unknown[]) => JSON.parse(String(call[0]))) as Array<{
        data: { name: string }
        type?: string
      }>
      const progress = events.filter(event => event.type === 'progress')

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('UPDATE_FAILED')
      expect(result.data?.results.map(item => [item.name, item.status])).toEqual([
        ['alpha', 'updated'],
        ['beta', 'failed'],
        ['gamma', 'manual-required'],
        ['zeta', 'locked'],
      ])
      expect(result.data?.results.at(-1)).toMatchObject({ resource: '/locks/zeta' })
      expect(progress.map(event => event.data.name)).toEqual(['alpha', 'beta', 'gamma', 'zeta'])
      expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
      expect(updateSpy).not.toHaveBeenCalled()
    } finally {
      batchSpy.mockRestore()
    }
  })

  it.each(['human', 'json', 'ndjson'] as const)(
    'projects a blocked untracked PATH install as manual-required in %s mode',
    async outputMode => {
      setCliContext({ interactive: false, outputMode, runId: `batch-untracked-${outputMode}` })
      mockBatchCommandAgents(['alpha'])
      const alpha = createBatchCommandUntrackedTarget('alpha')
      const batchRoot = requireLifecycleBatchRoot()
      const batchSpy = vi.spyOn(lifecycleUpdateProduction, batchRoot).mockResolvedValue({
        cancellationRemainder: [],
        kind: 'lifecycle-update-batch-outcome',
        plan: createBatchCommandPlan([alpha.target]),
        results: [alpha.result],
        success: false,
      } as never)

      try {
        const result = await updateCommand(undefined, true)

        expect(result.ok).toBe(true)
        expect(result.data?.results).toEqual([
          expect.objectContaining({
            message: expect.stringContaining('detected in PATH but not tracked'),
            name: 'alpha',
            status: 'manual-required',
          }),
        ])
        if (outputMode === 'human') {
          const output = stdoutWriteSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')
          expect(output).toContain('ALPHA: manual action required.')
          expect(output).toContain('quantex inspect alpha --json')
        } else {
          const output = logSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')
          expect(output).toContain('manual-required')
          expect(output).toContain('detected in PATH but not tracked')
        }
      } finally {
        batchSpy.mockRestore()
      }
    },
  )

  it.each(['human', 'json', 'ndjson'] as const)(
    'projects a typed manual planning block as manual-required in %s mode',
    async outputMode => {
      setCliContext({ interactive: false, outputMode, runId: `batch-manual-block-${outputMode}` })
      const manual = createBatchCommandManualBlockedTarget('manual-agent')
      agentSpy.mockImplementation(input => (input === manual.agent.name ? manual.agent : undefined))
      const batchRoot = requireLifecycleBatchRoot()
      const batchSpy = vi.spyOn(lifecycleUpdateProduction, batchRoot).mockResolvedValue({
        cancellationRemainder: [],
        kind: 'lifecycle-update-batch-outcome',
        plan: createBatchCommandPlan([manual.target]),
        results: [manual.result],
        success: false,
      } as never)

      try {
        const result = await updateCommand(undefined, true)

        expect(result.ok).toBe(true)
        expect(result.error).toBeNull()
        expect(result.data?.results).toEqual([
          expect.objectContaining({
            message: expect.stringContaining('manually managed install source'),
            name: manual.agent.name,
            status: 'manual-required',
          }),
        ])
        if (outputMode === 'human') {
          const output = stdoutWriteSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')
          expect(output).toContain(`${manual.agent.displayName}: manual action required.`)
          expect(output).toContain('manually managed install source')
        } else {
          const output = logSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')
          expect(output).toContain('manual-required')
          expect(output).toContain('manually managed install source')
        }
      } finally {
        batchSpy.mockRestore()
      }
    },
  )

  it.each([
    {
      agent: {
        ...testAgent,
        binaryName: 'manual-bin',
        displayName: 'Manual Agent',
        name: 'manual-agent',
        packages: undefined,
        platforms: {
          linux: [{ command: 'curl https://example.com/install | bash', type: 'script' as const }],
          macos: [{ command: 'curl https://example.com/install | bash', type: 'script' as const }],
          windows: [{ command: 'irm https://example.com/install | iex', type: 'script' as const }],
        },
      },
      installedState: undefined,
      label: 'package-less manual target',
    },
    {
      agent: {
        ...testAgent,
        binaryName: 'tracked-script-bin',
        displayName: 'Tracked Script Agent',
        name: 'tracked-script-agent',
        platforms: {
          linux: [{ command: 'curl https://example.com/install | bash', type: 'script' as const }],
          macos: [{ command: 'curl https://example.com/install | bash', type: 'script' as const }],
          windows: [{ command: 'irm https://example.com/install | iex', type: 'script' as const }],
        },
      },
      installedState: {
        agentName: 'tracked-script-agent',
        command: 'curl https://example.com/install | bash',
        installType: 'script' as const,
      },
      label: 'tracked script without a target version',
    },
  ])('keeps $label manual with actionable human guidance', async ({ agent, installedState }) => {
    agentSpy.mockImplementation(input => (input === agent.name ? agent : undefined))
    const manual = createBatchCommandTarget(agent.name, 'not-executed', 'manual-required', agent, installedState)
    const batchRoot = requireLifecycleBatchRoot()
    const batchSpy = vi.spyOn(lifecycleUpdateProduction, batchRoot).mockResolvedValue({
      cancellationRemainder: [],
      kind: 'lifecycle-update-batch-outcome',
      plan: createBatchCommandPlan([manual.target]),
      results: [manual.result],
      success: true,
    } as never)

    try {
      const result = await updateCommand(undefined, true)
      const output = stdoutWriteSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')

      expect(result.ok).toBe(true)
      expect(result.data?.results[0]).toMatchObject({ name: agent.name, status: 'manual-required' })
      expect(output).toContain(`${agent.displayName}: manual action required.`)
      expect(output).toContain('manually managed install source')
    } finally {
      batchSpy.mockRestore()
    }
  })

  it.each([
    {
      agent: {
        ...testAgent,
        binaryName: 'self-update-bin',
        displayName: 'Self Update Agent',
        name: 'self-update-agent',
        packages: undefined,
        selfUpdate: { command: ['self-update-bin', 'update'] },
      },
      expectedHint: 'Try running self-update-bin update directly.',
      label: 'self-update direct command',
    },
    {
      agent: {
        ...testAgent,
        binaryName: 'manual-failure-bin',
        displayName: 'Manual Failure Agent',
        homepage: 'https://example.com/manual-failure',
        name: 'manual-failure-agent',
        packages: undefined,
      },
      expectedHint: 'Check https://example.com/manual-failure for the recommended update path.',
      label: 'manual homepage',
    },
  ])('uses the observed source for a $label failure hint', async ({ agent, expectedHint }) => {
    agentSpy.mockImplementation(input => (input === agent.name ? agent : undefined))
    const failed = createBatchCommandProviderFailure(agent)
    const batchRoot = requireLifecycleBatchRoot()
    const batchSpy = vi.spyOn(lifecycleUpdateProduction, batchRoot).mockResolvedValue({
      cancellationRemainder: [],
      kind: 'lifecycle-update-batch-outcome',
      plan: createBatchCommandPlan([failed.target]),
      results: [failed.result],
      success: false,
    } as never)

    try {
      const result = await updateCommand(undefined, true)
      const output = stdoutWriteSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')

      expect(result.ok).toBe(false)
      expect(result.data?.results[0]?.hint).toBe(expectedHint)
      expect(output).toContain(expectedHint)
    } finally {
      batchSpy.mockRestore()
    }
  })

  it('keeps completed batch results and projects unstarted targets after cancellation', async () => {
    mockBatchCommandAgents(['alpha', 'beta', 'gamma'])
    const alpha = createBatchCommandTarget('alpha', 'updated')
    const beta = createBatchCommandTarget('beta', 'not-executed')
    const gamma = createBatchCommandTarget('gamma', 'not-executed')
    const batchRoot = requireLifecycleBatchRoot()
    const batchSpy = vi.spyOn(lifecycleUpdateProduction, batchRoot).mockResolvedValue({
      cancellationRemainder: [
        {
          agentName: beta.target.agentName,
          id: beta.target.id,
          planning: beta.target.outcome,
          reason: 'cancelled-after-alpha',
        },
        {
          agentName: gamma.target.agentName,
          id: gamma.target.id,
          planning: gamma.target.outcome,
          reason: 'cancelled-after-alpha',
        },
      ],
      kind: 'lifecycle-update-batch-outcome',
      plan: createBatchCommandPlan([alpha.target, beta.target, gamma.target]),
      results: [alpha.result],
      success: false,
    } as never)

    try {
      const result = await updateCommand(undefined, true)

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('CANCELLED')
      expect(result.data?.results.map(item => [item.name, item.status])).toEqual([
        ['alpha', 'updated'],
        ['beta', 'failed'],
        ['gamma', 'failed'],
      ])
      expect(result.data?.results.slice(1).every(item => item.message === 'cancelled-after-alpha')).toBe(true)
    } finally {
      batchSpy.mockRestore()
    }
  })

  it('does not report overall success for update --all after timeout cancellation', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'batch-update-timeout-run',
      timeoutMs: 50,
    })
    const batchRoot = requireLifecycleBatchRoot()
    const batchSpy = vi.spyOn(lifecycleUpdateProduction, batchRoot).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 200))
      return {
        cancellationRemainder: [],
        kind: 'lifecycle-update-batch-outcome',
        plan: createBatchCommandPlan([]),
        results: [],
        success: true,
      } as never
    })

    try {
      const runtimeResult = await executeCommandWithRuntime({
        action: 'update',
        run: () => updateCommand(undefined, true),
        target: {
          kind: 'agent',
        },
      })

      await new Promise(resolve => setTimeout(resolve, 250))

      expect(runtimeResult.ok).toBe(false)
      expect(['CANCELLED', 'TIMEOUT']).toContain(runtimeResult.error?.code)
      expect(batchSpy).toHaveBeenCalledOnce()
      expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
      expect(updateSpy).not.toHaveBeenCalled()
    } finally {
      batchSpy.mockRestore()
    }
  })
  it('does not infer self-update satisfaction without a target version', async () => {
    const selfUpdatingAgent = {
      ...testAgent,
      name: 'self-updating-agent',
      binaryName: 'self-updating-bin',
      displayName: 'Self Updating Agent',
      packages: undefined,
      selfUpdate: {
        command: ['self-updating-bin', 'update'],
      },
      platforms: {
        linux: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        macos: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        windows: [{ type: 'script' as const, command: 'irm https://example.com/install | iex' }],
      },
    }

    agentSpy.mockReturnValue(selfUpdatingAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue({
      agentName: 'self-updating-agent',
      installType: 'script',
      command: 'curl https://example.com/install | bash',
    })
    updateSpy.mockResolvedValue({ success: true })
    mockSingleLifecycleOutcome({ decision: 'manual-required', installedVersion: '1.0.0', providerId: 'script' })

    await updateCommand('self-updating-agent', false)

    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Self Updating Agent: manual action required.')
    expect(output).not.toContain('Self Updating Agent updated successfully')
  })

  it('keeps explicit untracked self-updates manual without a target version', async () => {
    const selfUpdatingAgent = {
      ...testAgent,
      name: 'self-updating-agent',
      binaryName: 'self-updating-bin',
      displayName: 'Self Updating Agent',
      packages: undefined,
      selfUpdate: {
        command: ['self-updating-bin', 'update'],
      },
      platforms: {
        linux: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        macos: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        windows: [{ type: 'script' as const, command: 'irm https://example.com/install | iex' }],
      },
    }

    agentSpy.mockReturnValue(selfUpdatingAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue(undefined)
    updateSpy.mockResolvedValue({ success: true })
    mockSingleLifecycleOutcome({ decision: 'manual-required', installedVersion: '1.0.0', providerId: 'script' })

    await updateCommand('self-updating-agent', false)

    expect(updateSpy).not.toHaveBeenCalled()
    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Self Updating Agent: manual action required.')
    expect(output).not.toContain('Self Updating Agent updated successfully')
  })

  it('does not invoke self-update failure paths without a target version', async () => {
    const selfUpdatingAgent = {
      ...testAgent,
      name: 'self-updating-agent',
      binaryName: 'self-updating-bin',
      displayName: 'Self Updating Agent',
      homepage: 'https://example.com/self-updating-agent',
      packages: undefined,
      selfUpdate: {
        command: ['self-updating-bin', 'update'],
      },
      platforms: {
        linux: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        macos: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        windows: [{ type: 'script' as const, command: 'irm https://example.com/install | iex' }],
      },
    }

    agentSpy.mockReturnValue(selfUpdatingAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue(undefined)
    updateSpy.mockResolvedValue({ success: false })
    mockSingleLifecycleOutcome({ decision: 'manual-required', installedVersion: '1.0.0', providerId: 'script' })

    await updateCommand('self-updating-agent', false)

    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(updateSpy).not.toHaveBeenCalled()
    expect(output).toContain('Self Updating Agent: manual action required.')
    expect(output).not.toContain('Failed to update Self Updating Agent.')
  })

  it('returns a stable conflict when another lifecycle operation already holds the lock', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockResolvedValue(undefined)
    updateAgentsByTypeSpy.mockRejectedValue(new ResourceLockError('agent lifecycle', '/tmp/agent-lifecycle.lock'))
    lifecycleUpdateSpy.mockRejectedValue(new ResourceLockError('agent lifecycle', '/tmp/agent-lifecycle.lock'))

    const result = await updateCommand('test-agent', false)

    expect(result.error?.code).toBe('RESOURCE_LOCKED')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('agent lifecycle lock'))
  })

  it('returns a dry-run plan without invoking update executors', async () => {
    setCliContext({
      dryRun: true,
      interactive: false,
      outputMode: 'json',
      runId: 'dry-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockResolvedValue(undefined)
    mockSingleLifecycleOutcome({
      decision: 'upgrade',
      installedVersion: '1.0.0',
      kind: 'dry-run',
      latestVersion: '2.0.0',
    })

    const result = await updateCommand('test-agent', false)

    expect(result.ok).toBe(true)
    expect(result.data?.results[0]?.status).toBe('planned')
    expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('shows error when no agent specified and no --all flag', async () => {
    await updateCommand(undefined, false)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Please specify'))
  })

  it('emits ndjson progress events for streamed updates', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'ndjson',
      runId: 'update-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockResolvedValue(undefined)
    updateAgentsByTypeSpy.mockResolvedValue(true)
    mockSingleLifecycleOutcome({
      decision: 'upgrade',
      installedVersion: '1.0.0',
      kind: 'updated',
      latestVersion: '2.0.0',
    })

    await updateCommand('test-agent', false)

    const startedEvent = JSON.parse(logSpy.mock.calls[0][0])
    const progressEvent = JSON.parse(logSpy.mock.calls[1][0])
    const resultEvent = JSON.parse(logSpy.mock.calls[2][0])
    expect(startedEvent.type).toBe('started')
    expect(startedEvent.data.scope).toBe('single')
    expect(progressEvent.type).toBe('progress')
    expect(progressEvent.data.status).toBe('updated')
    expect(resultEvent.type).toBe('result')
    expect(resultEvent.data.ok).toBe(true)
    expect(resultEvent.meta.runId).toBe('update-run-id')
  })
})

function mockSingleLifecycleOutcome(options: {
  decision: 'manual-required' | 'up-to-date' | 'upgrade'
  installedVersion: string
  kind?: 'dry-run' | 'not-executed' | 'updated'
  latestVersion?: string
  providerId?: ProviderId
}): void {
  const providerId = options.providerId ?? 'bun'
  const target = { id: 'test-pkg', kind: 'package' as const }
  const observation = {
    drift: { kind: 'none' as const },
    kind: 'present' as const,
    providerId,
    providerTargetId: target.id,
    providerTargetKind: target.kind,
    targetId: 'test-agent',
    version: options.installedVersion,
  }
  const before = {
    agent: testAgent,
    binding: { providerId, target },
    capabilities: ['observe', 'resolve-latest-version', 'update', 'verify'] as const,
    executable: { present: true, version: options.installedVersion },
    installedState: { agentName: 'test-agent', installType: providerId, packageName: target.id },
    methods: [],
    observation,
  }
  const plan = {
    before,
    binding: { providerId, target },
    plannedTargetVersion: options.latestVersion ?? options.installedVersion,
    planning: {
      decision: options.decision,
      plan: {
        id: 'update-test-agent',
        intent: {
          kind: 'update' as const,
          targetId: 'test-agent',
          targetVersion: options.latestVersion ?? options.installedVersion,
        },
        kind: 'lifecycle-plan' as const,
        observation,
        steps: [],
      },
    },
  }
  const kind = options.kind ?? 'not-executed'
  let outcome: RunSingleAgentLifecycleUpdateOutcome
  if (kind === 'updated') {
    const afterObservation = { ...observation, version: options.latestVersion }
    outcome = {
      after: {
        ...before,
        executable: { present: true, version: options.latestVersion },
        observation: afterObservation,
      },
      kind,
      plan,
      providerOutcome: { kind: 'success', value: { evidence: [], target } },
      receipt: {
        kind: 'lifecycle-receipt',
        providerId,
        providerTargetId: target.id,
        providerTargetKind: target.kind,
        schemaVersion: 1,
        targetId: 'test-agent',
        verifiedAt: '2026-07-13T04:00:00.000Z',
        version: options.latestVersion,
      },
      verification: {
        kind: 'satisfied',
        observation: afterObservation,
        postcondition: {
          expectedVersion: options.latestVersion!,
          kind: 'version-satisfies',
          targetId: target.id,
        },
      },
    }
  } else {
    outcome = { kind, plan }
  }
  lifecycleUpdateSpy.mockResolvedValue(outcome)
}

function requireLifecycleBatchRoot(): 'runLifecycleUpdateBatch' {
  expect(lifecycleUpdateProduction).toHaveProperty('runLifecycleUpdateBatch')
  if (!('runLifecycleUpdateBatch' in lifecycleUpdateProduction)) {
    throw new Error('Expected lifecycle update production module to export runLifecycleUpdateBatch')
  }
  return 'runLifecycleUpdateBatch'
}

function mockBatchCommandAgents(names: readonly string[]): void {
  const definitions = names.map(name => ({
    ...testAgent,
    binaryName: `${name}-bin`,
    displayName: name.toUpperCase(),
    name,
  }))
  agentSpy.mockImplementation(input => definitions.find(agent => agent.name === input))
}

function createBatchCommandTarget(
  name: string,
  executionKind: 'locked' | 'not-executed' | 'updated',
  decision: 'manual-required' | 'up-to-date' | 'upgrade' = 'upgrade',
  agentOverride?: AgentDefinition,
  installedStateOverride?: InstalledAgentState,
) {
  const agent = agentOverride ?? { ...testAgent, binaryName: `${name}-bin`, displayName: name.toUpperCase(), name }
  const target = { binaryName: agent.binaryName, id: `@scope/${name}`, kind: 'package' as const }
  const observation = {
    drift: { kind: 'none' as const },
    kind: 'present' as const,
    providerId: 'npm' as const,
    providerTargetId: target.id,
    providerTargetKind: target.kind,
    targetId: name,
    version: '1.0.0',
  }
  const before = {
    agent,
    binding: { providerId: 'npm' as const, target },
    capabilities: ['observe', 'resolve-latest-version', 'update', 'verify'] as const,
    executable: { present: true, version: '1.0.0' },
    installedState: installedStateOverride,
    methods: [{ packageName: target.id, type: 'npm' as const }],
    observation,
    persistedBinding: { providerId: 'npm' as const, target },
  }
  const planned = {
    before,
    binding: { providerId: 'npm' as const, target },
    plannedTargetVersion: '2.0.0',
    planning: {
      decision,
      plan: {
        id: `update-${name}`,
        intent: { kind: 'update' as const, targetId: name, targetVersion: '2.0.0' },
        kind: 'lifecycle-plan' as const,
        observation,
        steps: [],
      },
    },
  }
  const planning = { kind: 'planned' as const, planned }
  const batchTarget = { agentName: name, id: `target-${name}`, outcome: planning }
  const execution =
    executionKind === 'locked'
      ? { kind: 'locked' as const, plan: planned, reason: `${name} locked`, resource: `/locks/${name}` }
      : executionKind === 'not-executed'
        ? { kind: 'not-executed' as const, plan: planned }
        : {
            after: { ...before, executable: { present: true, version: '2.0.0' } },
            kind: 'updated' as const,
            plan: planned,
            providerOutcome: { kind: 'success' as const, value: { evidence: [], target } },
            receipt: {
              kind: 'lifecycle-receipt' as const,
              providerId: 'npm' as const,
              providerTargetId: target.id,
              providerTargetKind: target.kind,
              schemaVersion: 1 as const,
              targetId: name,
              verifiedAt: '2026-07-13T04:00:00.000Z',
              version: '2.0.0',
            },
            verification: {
              kind: 'satisfied' as const,
              observation: { ...observation, version: '2.0.0' },
              postcondition: { expectedVersion: '2.0.0', kind: 'version-satisfies' as const, targetId: target.id },
            },
          }
  return {
    result: { agentName: name, execution, id: batchTarget.id, planning },
    target: batchTarget,
  }
}

function createBatchCommandUntrackedTarget(name: string) {
  const agent = { ...testAgent, binaryName: `${name}-bin`, displayName: name.toUpperCase(), name }
  const before = {
    agent,
    capabilities: ['observe'] as const,
    executable: { present: true, version: '1.0.0' },
    methods: [],
    observation: {
      drift: {
        kind: 'untracked' as const,
        reason: `${name} is on PATH without a lifecycle receipt or managed state.`,
      },
      kind: 'present' as const,
      targetId: name,
      version: '1.0.0',
    },
  }
  const planning = {
    before,
    category: 'untracked' as const,
    kind: 'blocked' as const,
    reason: `Cannot infer the update source for ${name}.`,
  }
  const target = { agentName: name, id: `target-${name}`, outcome: planning }
  return { result: { agentName: name, id: target.id, planning }, target }
}

function createBatchCommandManualBlockedTarget(name: string) {
  const agent = {
    ...testAgent,
    binaryName: `${name}-bin`,
    displayName: 'Manual Agent',
    name,
    packages: undefined,
    platforms: {
      linux: [{ command: 'curl https://example.com/install | bash', type: 'script' as const }],
      macos: [{ command: 'curl https://example.com/install | bash', type: 'script' as const }],
      windows: [{ command: 'irm https://example.com/install | iex', type: 'script' as const }],
    },
  }
  const providerTarget = {
    binaryName: agent.binaryName,
    effect: { command: 'curl https://example.com/install | bash', kind: 'shell-script' as const },
    id: `script:${name}`,
    kind: 'script' as const,
  }
  const before = {
    agent,
    binding: { providerId: 'script' as const, target: providerTarget },
    capabilities: ['availability', 'observe', 'install'] as const,
    executable: { present: true, version: '1.0.0' },
    installedState: {
      agentName: name,
      command: 'curl https://example.com/install | bash',
      installType: 'script' as const,
    },
    methods: [{ command: 'curl https://example.com/install | bash', type: 'script' as const }],
    observation: {
      drift: { kind: 'none' as const },
      kind: 'present' as const,
      providerId: 'script' as const,
      providerTargetId: providerTarget.id,
      providerTargetKind: providerTarget.kind,
      targetId: name,
      version: '1.0.0',
    },
    persistedBinding: { providerId: 'script' as const, target: providerTarget },
  }
  const planning = {
    before,
    category: 'manual-required' as const,
    kind: 'blocked' as const,
    reason: 'Provider script cannot resolve an update target version.',
  }
  const target = { agentName: name, id: `target-${name}`, outcome: planning }
  return { agent, result: { agentName: name, id: target.id, planning }, target }
}

function createBatchCommandProviderFailure(agent: AgentDefinition) {
  const before = {
    agent,
    capabilities: ['observe'] as const,
    executable: { present: true, version: '1.0.0' },
    methods: [{ command: `curl https://example.com/${agent.name} | bash`, type: 'script' as const }],
    observation: {
      drift: { kind: 'none' as const },
      kind: 'present' as const,
      targetId: agent.name,
      version: '1.0.0',
    },
  }
  const planning = {
    before,
    kind: 'provider-failed' as const,
    providerOutcome: { kind: 'failed' as const, reason: `${agent.name} observation failed`, retryable: true },
  }
  const target = { agentName: agent.name, id: `target-${agent.name}`, outcome: planning }
  return { result: { agentName: agent.name, id: target.id, planning }, target }
}

function createBatchCommandPlanningFailure(name: string) {
  const planned = createBatchCommandTarget(name, 'not-executed')
  const before = planned.target.outcome.planned.before
  const planning = {
    before,
    category: 'unsafe-source' as const,
    kind: 'blocked' as const,
    reason: `${name} live source evidence is unsafe`,
  }
  const target = { agentName: name, id: `target-${name}`, outcome: planning }
  return { result: { agentName: name, id: target.id, planning }, target }
}

function createBatchCommandPlan(targets: readonly unknown[]) {
  return {
    id: 'batch-plan',
    kind: 'lifecycle-update-batch-plan' as const,
    providerBuckets: [],
    resolvedPlanId: 'batch-plan',
    targets,
  }
}
