import type { AgentDefinition } from '../../src/agents/types'
import type {
  CoreInstallationExecutionHooks,
  CoreInstallationExecutionOutcome,
  CoreInstallationExecutorPorts,
  CoreInstallationRecipe,
} from '../../src/core/installation-executor'
import type { CoreAgentObservation } from '../../src/core/production-observation'
import type { CoreRequestOptions } from '../../src/core/types'
import type { LifecycleObservation, LifecycleReceipt } from '../../src/lifecycle/model'
import type { LifecycleProviderBinding } from '../../src/lifecycle/provider-binding'
import type { ProviderMutationEvidence, ProviderOutcome, ProviderVerification } from '../../src/providers/types'
import type { InstalledAgentState } from '../../src/state/schema'
import { describe, expect, it } from 'vitest'
import { executeCoreInstallation } from '../../src/core/installation-executor'
import { runCoreInvocation } from '../../src/core/invocation'

const agent: AgentDefinition = {
  binaryName: 'fixture-agent',
  displayName: 'Fixture Agent',
  homepage: 'https://example.com/fixture-agent',
  name: 'fixture-agent',
  packages: { npm: 'fixture-agent' },
  platforms: { linux: [{ type: 'npm' }] },
}

const npmBinding: LifecycleProviderBinding = {
  providerId: 'npm',
  target: { id: 'fixture-agent', kind: 'package' },
}

const bunBinding: LifecycleProviderBinding = {
  providerId: 'bun',
  target: { id: 'fixture-agent', kind: 'package' },
}

const npmRecipe: CoreInstallationRecipe = {
  binding: npmBinding,
  compensation: 'provider-uninstall',
  installedState: {
    agentName: agent.name,
    binaryName: agent.binaryName,
    installType: 'npm',
    packageName: npmBinding.target.id,
  },
  ownership: 'created-on-success',
}

describe('Core installation executor fault handling', () => {
  it('keeps preview read-only without taking the mutation lock or running side effects', async () => {
    const harness = createHarness({ observations: [missingObservation()] })

    const outcome = await execute(harness.ports, { mode: 'preview', name: agent.name, operation: 'ensure' })

    expect(outcome).toEqual({
      kind: 'success',
      value: {
        before: expect.objectContaining({ observation: expect.objectContaining({ kind: 'absent' }) }),
        binding: npmBinding,
        decision: 'install',
        kind: 'preview',
        wouldChange: true,
      },
    })
    expect(harness.events).toEqual(['observe:0', 'resolve'])
  })

  it('freshly observes an unchanged managed installation while holding the mutation lock', async () => {
    const before = managedObservation('2026-07-22T00:00:00.000Z')
    const after = managedObservation('2026-07-22T00:00:01.000Z')
    const harness = createHarness({ observations: [before, after] })

    const outcome = await execute(harness.ports)

    expect(outcome).toEqual({
      kind: 'success',
      value: {
        after,
        before,
        binding: npmBinding,
        changed: false,
        decision: 'already-satisfied',
        kind: 'apply',
      },
    })
    expect(harness.events).toEqual(['lock:acquire', 'observe:0', 'observe:1', 'lock:release'])
  })

  it('turns an initial observation rejection into a typed decision failure', async () => {
    const harness = createHarness({
      overrides: {
        async observe() {
          harness.events.push('observe:reject')
          throw new Error('observation port rejected')
        },
      },
    })

    const outcome = await execute(harness.ports)

    expect(outcome).toEqual({
      error: {
        cause: expect.any(Error),
        code: 'decision-indeterminate',
        phase: 'decide',
        reason: 'observation port rejected',
        retryable: false,
        sideEffect: 'none',
      },
      kind: 'failed',
    })
    expect(harness.events).toEqual(['lock:acquire', 'observe:reject', 'lock:release'])
  })

  it('turns recipe resolution rejection into a typed no-side-effect failure', async () => {
    const harness = createHarness({
      observations: [missingObservation()],
      overrides: {
        async resolveRecipe() {
          harness.events.push('resolve')
          throw new Error('recipe port rejected')
        },
      },
    })

    const outcome = await execute(harness.ports)

    expect(outcome).toEqual({
      error: {
        code: 'recipe-unavailable',
        phase: 'decide',
        reason: 'recipe port rejected',
        retryable: false,
        sideEffect: 'none',
      },
      kind: 'failed',
    })
    expect(harness.events).toEqual(['lock:acquire', 'observe:0', 'resolve', 'lock:release'])
  })

  it('rejects a recipe whose schema-v2 state does not preserve the selected source before mutation', async () => {
    const harness = createHarness({
      observations: [missingObservation()],
      recipe: { ...npmRecipe, installedState: installedStateFor(bunBinding) },
    })

    const outcome = await execute(harness.ports)

    expect(outcome).toMatchObject({
      error: {
        code: 'recipe-unavailable',
        phase: 'decide',
        reason: 'Resolved recipe does not preserve the schema-v2 provider source identity.',
        sideEffect: 'none',
      },
      kind: 'failed',
    })
    expect(harness.events).toEqual(['lock:acquire', 'observe:0', 'resolve', 'lock:release'])
  })

  it('rejects pre-existing ownership from the normal installation recipe resolver', async () => {
    const harness = createHarness({
      observations: [missingObservation()],
      recipe: { ...npmRecipe, ownership: 'pre-existing' },
    })

    const outcome = await execute(harness.ports)

    expect(outcome).toMatchObject({
      error: {
        code: 'recipe-unavailable',
        phase: 'decide',
        reason: 'Resolved installation recipes must prove created-on-success ownership.',
        sideEffect: 'none',
      },
      kind: 'failed',
    })
    expect(harness.events).toEqual(['lock:acquire', 'observe:0', 'resolve', 'lock:release'])
  })

  it('serializes observe, resolve, install, verify, record, and fresh observation on success', async () => {
    const before = missingObservation()
    const verified = untrackedObservation(npmBinding, '2026-07-22T00:00:01.000Z')
    const after = managedObservation('2026-07-22T00:00:01.000Z')
    const harness = createHarness({ observations: [before, verified, after] })

    const outcome = await execute(harness.ports)

    expect(outcome).toEqual({
      kind: 'success',
      value: {
        after,
        before,
        binding: npmBinding,
        changed: true,
        decision: 'install',
        kind: 'apply',
      },
    })
    expect(harness.events).toEqual([
      'lock:acquire',
      'observe:0',
      'resolve',
      'install',
      'verify',
      'observe:1',
      'record:prepare',
      'record:apply',
      'observe:2',
      'record:commit',
      'lock:release',
    ])
    expect(harness.events).not.toContain('record:rollback')
    expect(harness.prepared).toHaveLength(1)
    expect(harness.prepared[0]).toMatchObject({ before, recipe: npmRecipe, verified })
    expect(harness.prepared[0]?.context.signal).toBeInstanceOf(AbortSignal)
  })

  it('reports a provider install failure as an execute-phase side effect that may remain', async () => {
    const harness = createHarness({
      observations: [missingObservation()],
      overrides: {
        async install() {
          harness.events.push('install')
          return {
            kind: 'failed',
            reason: 'installer exited after changing files',
            retryable: false,
          }
        },
      },
    })

    const outcome = await execute(harness.ports)

    expect(outcome).toEqual({
      error: {
        code: 'execution-failed',
        phase: 'execute',
        reason: 'installer exited after changing files',
        retryable: false,
        sideEffect: 'may-remain',
      },
      kind: 'failed',
    })
    expect(harness.events).toEqual(['lock:acquire', 'observe:0', 'resolve', 'install', 'lock:release'])
  })

  it('compensates a provider-owned install when fresh verification is unsatisfied', async () => {
    const harness = createHarness({
      observations: [missingObservation()],
      overrides: {
        async verify() {
          harness.events.push('verify')
          return {
            kind: 'success',
            value: { evidence: [], kind: 'unsatisfied', reason: 'executable is still missing' },
          }
        },
      },
    })

    const outcome = await execute(harness.ports)

    expect(outcome).toEqual({
      error: {
        code: 'verification-failed',
        phase: 'verify',
        reason: 'executable is still missing',
        retryable: false,
        sideEffect: 'compensated',
      },
      kind: 'failed',
    })
    expect(harness.events).toEqual([
      'lock:acquire',
      'observe:0',
      'resolve',
      'install',
      'verify',
      'compensate',
      'lock:release',
    ])
  })

  it('turns provider verification rejection into a typed compensated failure', async () => {
    const harness = createHarness({
      observations: [missingObservation()],
      overrides: {
        async verify() {
          harness.events.push('verify')
          throw new Error('verification port rejected')
        },
      },
    })

    const outcome = await execute(harness.ports)

    expect(outcome).toEqual({
      error: {
        code: 'verification-failed',
        phase: 'verify',
        reason: 'verification port rejected',
        retryable: false,
        sideEffect: 'compensated',
      },
      kind: 'failed',
    })
    expect(harness.events).toEqual([
      'lock:acquire',
      'observe:0',
      'resolve',
      'install',
      'verify',
      'compensate',
      'lock:release',
    ])
  })

  it('does not prepare state when the fresh full observation cannot confirm the exact source', async () => {
    const harness = createHarness({
      observations: [missingObservation(), untrackedObservation(bunBinding)],
    })

    const outcome = await execute(harness.ports)

    expect(outcome).toMatchObject({
      error: {
        code: 'verification-failed',
        phase: 'verify',
        sideEffect: 'compensated',
      },
      kind: 'failed',
    })
    expect(harness.events).toEqual([
      'lock:acquire',
      'observe:0',
      'resolve',
      'install',
      'verify',
      'observe:1',
      'compensate',
      'lock:release',
    ])
    expect(harness.events).not.toContain('record:prepare')
    expect(harness.events).not.toContain('record:apply')
  })

  it('turns fresh full-observation rejection into a typed compensated failure before recording', async () => {
    let observationCount = 0
    const harness = createHarness({
      overrides: {
        async observe() {
          harness.events.push(`observe:${observationCount}`)
          observationCount += 1
          if (observationCount === 1) return missingObservation()
          throw new Error('fresh observation rejected')
        },
      },
    })

    const outcome = await execute(harness.ports)

    expect(outcome).toMatchObject({
      error: {
        code: 'verification-failed',
        phase: 'verify',
        reason: 'fresh observation rejected',
        sideEffect: 'compensated',
      },
      kind: 'failed',
    })
    expect(harness.events).not.toContain('record:prepare')
    expect(harness.events).toContain('compensate')
  })

  it.each([
    ['script', 'script'],
    ['binary', 'binary'],
  ] as const)('does not guess at deleting a manual %s install', async (providerId, targetKind) => {
    const binding: LifecycleProviderBinding = {
      providerId,
      target: { binaryName: agent.binaryName, id: 'manual-effect', kind: targetKind },
    }
    const harness = createHarness({
      observations: [missingObservation()],
      recipe: {
        binding,
        compensation: 'manual',
        installedState: {
          agentName: agent.name,
          binaryName: agent.binaryName,
          command: binding.target.id,
          installType: providerId,
        },
        ownership: 'created-on-success',
      },
      overrides: {
        async verify() {
          harness.events.push('verify')
          return {
            kind: 'success',
            value: { evidence: [], kind: 'unsatisfied', reason: 'manual effect was not verifiable' },
          }
        },
      },
    })

    const outcome = await execute(harness.ports)

    expect(outcome).toMatchObject({
      error: {
        code: 'verification-failed',
        phase: 'verify',
        reason: 'manual effect was not verifiable',
        remediation: expect.stringContaining('remove any partial installation manually'),
        sideEffect: 'may-remain',
      },
      kind: 'failed',
    })
    expect(harness.events).not.toContain('compensate')
  })

  it('rolls state back before compensating when record application fails', async () => {
    const harness = createHarness({
      observations: [missingObservation(), untrackedObservation()],
      record: {
        async apply() {
          harness.events.push('record:apply')
          throw new Error('state rename failed')
        },
        async commit() {
          harness.events.push('record:commit')
        },
        async rollback() {
          harness.events.push('record:rollback')
        },
      },
    })

    const outcome = await execute(harness.ports)

    expect(outcome).toEqual({
      error: {
        code: 'recording-failed',
        phase: 'record',
        reason: 'state rename failed',
        retryable: false,
        sideEffect: 'compensated',
      },
      kind: 'failed',
    })
    expect(harness.events).toEqual([
      'lock:acquire',
      'observe:0',
      'resolve',
      'install',
      'verify',
      'observe:1',
      'record:prepare',
      'record:apply',
      'record:rollback',
      'compensate',
      'lock:release',
    ])
  })

  it('preserves provider resources when state rollback is uncertain', async () => {
    const harness = createHarness({
      observations: [missingObservation(), untrackedObservation()],
      record: {
        async apply() {
          harness.events.push('record:apply')
          throw new Error('state write failed')
        },
        async commit() {
          harness.events.push('record:commit')
        },
        async rollback() {
          harness.events.push('record:rollback')
          throw new Error('state rollback failed')
        },
      },
    })

    const outcome = await execute(harness.ports)

    expect(outcome).toMatchObject({
      error: {
        code: 'compensation-failed',
        originCode: 'recording-failed',
        remediation: expect.stringContaining('Keep the installed resource in place'),
        sideEffect: 'may-remain',
      },
      kind: 'failed',
    })
    expect(outcome.kind === 'failed' ? outcome.error.remediation : undefined).not.toContain('remove')
    expect(harness.events).not.toContain('compensate')
  })

  it.each(['state', 'receipt', 'final'] as const)(
    'rolls back and compensates when the recorded %s binding disagrees with the selected source',
    async mismatch => {
      const harness = createHarness({
        observations: [missingObservation(), untrackedObservation(), inconsistentManagedObservation(mismatch)],
      })

      const outcome = await execute(harness.ports)

      expect(outcome).toMatchObject({
        error: {
          code: 'verification-failed',
          phase: 'verify',
          sideEffect: 'compensated',
        },
        kind: 'failed',
      })
      expect(harness.events).toContain('record:apply')
      expect(harness.events).toContain('record:rollback')
      expect(harness.events).toContain('compensate')
      expect(harness.events).not.toContain('record:commit')
      expect(harness.events.indexOf('record:rollback')).toBeLessThan(harness.events.indexOf('compensate'))
    },
  )

  it('escalates a failed provider compensation with manual remediation', async () => {
    const harness = createHarness({
      observations: [missingObservation()],
      overrides: {
        async compensate() {
          harness.events.push('compensate')
          return { kind: 'failed', reason: 'uninstall failed', retryable: false }
        },
        async verify() {
          harness.events.push('verify')
          return {
            kind: 'success',
            value: { evidence: [], kind: 'unsatisfied', reason: 'verification failed' },
          }
        },
      },
    })

    const outcome = await execute(harness.ports)

    expect(outcome).toMatchObject({
      error: {
        code: 'compensation-failed',
        phase: 'compensate',
        reason: 'verification failed uninstall failed',
        remediation: expect.stringContaining('remove any partial installation manually'),
        retryable: false,
        sideEffect: 'may-remain',
      },
      kind: 'failed',
    })
  })

  it('keeps external cancellation sticky when install reports a late success', async () => {
    const installStarted = deferred<void>()
    const cleanupStarted = deferred<void>()
    const allowCleanup = deferred<void>()
    const finishInstall = deferred<ProviderOutcome<ProviderMutationEvidence>>()
    const controller = new AbortController()
    const harness = createHarness({
      observations: [missingObservation()],
      overrides: {
        async install(_recipe, context) {
          harness.events.push('install:start')
          context.registerCleanup?.({
            async cleanup() {
              harness.events.push('provider:cleanup')
              cleanupStarted.resolve()
              await allowCleanup.promise
              finishInstall.resolve(successfulMutation(npmRecipe))
            },
          })
          installStarted.resolve()
          const outcome = await finishInstall.promise
          harness.events.push('install:late-success')
          return outcome
        },
      },
    })

    const invocation = invoke(harness.ports, { signal: controller.signal })
    await installStarted.promise
    controller.abort(new Error('stop install'))
    await cleanupStarted.promise
    expect(await Promise.race([invocation.then(() => 'settled'), Promise.resolve('pending')])).toBe('pending')

    allowCleanup.resolve()
    const outcome = await invocation

    expect(outcome).toMatchObject({
      error: {
        code: 'cancelled',
        details: { phase: 'execute', reason: 'stop install', sideEffect: 'compensated' },
      },
      kind: 'failure',
    })
    expect(harness.events).toContain('provider:cleanup')
    expect(harness.events).toContain('compensate')
    expect(harness.events).not.toContain('record:prepare')
    expect(harness.events).not.toContain('observe:1')
  })

  it('waits for an in-flight record write, rolls it back, and then returns external cancellation', async () => {
    const recordStarted = deferred<void>()
    const finishRecord = deferred<void>()
    const controller = new AbortController()
    const harness = createHarness({
      observations: [missingObservation(), untrackedObservation()],
      record: {
        async apply() {
          harness.events.push('record:apply:start')
          recordStarted.resolve()
          await finishRecord.promise
          harness.events.push('record:apply:late-success')
        },
        async commit() {
          harness.events.push('record:commit')
        },
        async rollback() {
          harness.events.push('record:rollback')
        },
      },
    })

    const invocation = invoke(harness.ports, { signal: controller.signal })
    await recordStarted.promise
    controller.abort('stop record')
    expect(await Promise.race([invocation.then(() => 'settled'), Promise.resolve('pending')])).toBe('pending')

    finishRecord.resolve()
    const outcome = await invocation

    expect(outcome).toMatchObject({
      error: {
        code: 'cancelled',
        details: { phase: 'record', reason: 'stop record', sideEffect: 'compensated' },
      },
      kind: 'failure',
    })
    expect(harness.events).toContain('record:rollback')
    expect(harness.events).toContain('compensate')
    expect(harness.events).not.toContain('observe:2')
    expect(harness.events).not.toContain('record:commit')
    expect(harness.events.indexOf('record:rollback')).toBeLessThan(harness.events.indexOf('compensate'))
  })

  it.each([
    ['cancelled', { kind: 'cancelled', reason: 'provider stopped' }],
    ['timed-out', { kind: 'timed-out', timeoutMs: 23 }],
  ] as const)(
    'drains provider cleanup before returning a provider-originated %s outcome',
    async (kind, interruption) => {
      const harness = createHarness({
        observations: [missingObservation()],
        overrides: {
          async install(_recipe, context) {
            harness.events.push('install')
            context.registerCleanup?.({
              cleanup() {
                harness.events.push('provider:cleanup')
              },
            })
            return interruption
          },
        },
      })

      const outcome = await invoke(harness.ports)

      expect(outcome).toMatchObject({
        error: {
          code: kind,
          details: {
            phase: 'execute',
            sideEffect: 'may-remain',
            ...(kind === 'timed-out' ? { timeoutMs: 23 } : { reason: 'provider stopped' }),
          },
        },
        kind: 'failure',
      })
      expect(harness.events).toContain('provider:cleanup')
      expect(harness.events).not.toContain('record:prepare')
    },
  )

  it('keeps an external installation unmanaged when the private adoption hook is absent', async () => {
    const before = untrackedObservation()
    const after = untrackedObservation(npmBinding, '2026-07-22T00:00:01.000Z')
    const harness = createHarness({ observations: [before, after] })

    const outcome = await execute(harness.ports)

    expect(outcome).toEqual({
      kind: 'success',
      value: {
        after,
        before,
        binding: npmBinding,
        changed: false,
        decision: 'external-preserved',
        kind: 'apply',
      },
    })
    expect(harness.events).toEqual(['lock:acquire', 'observe:0', 'observe:1', 'lock:release'])
  })

  it('previews private compatibility adoption without taking a lock or writing state', async () => {
    const before = untrackedObservation()
    const harness = createHarness({ observations: [before] })

    const outcome = await execute(
      harness.ports,
      { mode: 'preview', name: agent.name, operation: 'ensure' },
      adoptionHooks(harness.events),
    )

    expect(outcome).toEqual({
      kind: 'success',
      value: {
        before,
        binding: npmBinding,
        compatibility: { kind: 'adopt' },
        decision: 'external-preserved',
        kind: 'preview',
        wouldChange: true,
      },
    })
    expect(harness.events).toEqual(['observe:0', 'adoption:resolve'])
  })

  it('adopts a verified external installation under one Core mutation lock without installing it', async () => {
    const before = untrackedObservation()
    const verified = untrackedObservation(npmBinding, '2026-07-22T00:00:01.000Z')
    const after = managedObservation('2026-07-22T00:00:02.000Z')
    const harness = createHarness({ observations: [before, verified, after] })

    const outcome = await execute(harness.ports, undefined, adoptionHooks(harness.events))

    expect(outcome).toEqual({
      kind: 'success',
      value: {
        after,
        before,
        binding: npmBinding,
        changed: true,
        compatibility: { kind: 'adopt' },
        decision: 'external-preserved',
        kind: 'apply',
      },
    })
    expect(harness.events).toEqual([
      'lock:acquire',
      'observe:0',
      'adoption:resolve',
      'verify',
      'observe:1',
      'mutation:start:external-preserved',
      'record:prepare',
      'record:apply',
      'observe:2',
      'record:commit',
      'lock:release',
    ])
    expect(harness.events).not.toContain('install')
    expect(harness.events).not.toContain('compensate')
    expect(harness.prepared[0]?.recipe).toEqual({
      binding: npmBinding,
      compensation: 'manual',
      installedState: installedStateFor(npmBinding),
      ownership: 'pre-existing',
    })
  })

  it('fails closed before recording when an adoption cannot verify the live provider source', async () => {
    const harness = createHarness({
      observations: [untrackedObservation()],
      overrides: {
        async verify() {
          harness.events.push('verify')
          return {
            kind: 'success',
            value: { evidence: [], kind: 'unsatisfied', reason: 'provider source is absent' },
          }
        },
      },
    })

    const outcome = await execute(harness.ports, undefined, adoptionHooks(harness.events))

    expect(outcome).toMatchObject({
      error: {
        code: 'verification-failed',
        phase: 'verify',
        reason: 'provider source is absent',
        sideEffect: 'none',
      },
      kind: 'failed',
    })
    expect(harness.events).toEqual(['lock:acquire', 'observe:0', 'adoption:resolve', 'verify', 'lock:release'])
  })

  it('fails closed when a fresh adoption observation is no longer untracked', async () => {
    const conflict = {
      ...untrackedObservation(npmBinding, '2026-07-22T00:00:01.000Z'),
      installedState: installedStateFor(npmBinding),
      observation: present(
        { kind: 'conflicting-source', observedProviderId: 'npm', recordedProviderId: 'bun' },
        '2026-07-22T00:00:01.000Z',
      ),
      persistedBinding: npmBinding,
    }
    const harness = createHarness({ observations: [untrackedObservation(), conflict] })

    const outcome = await execute(harness.ports, undefined, adoptionHooks(harness.events))

    expect(outcome).toMatchObject({
      error: { code: 'verification-failed', phase: 'verify', sideEffect: 'none' },
      kind: 'failed',
    })
    expect(harness.events).toEqual([
      'lock:acquire',
      'observe:0',
      'adoption:resolve',
      'verify',
      'observe:1',
      'lock:release',
    ])
    expect(harness.events).not.toContain('mutation:start:external-preserved')
    expect(harness.events).not.toContain('record:prepare')
  })

  it('rolls adoption state back without uninstalling a pre-existing installation', async () => {
    const harness = createHarness({
      observations: [untrackedObservation(), untrackedObservation()],
      record: {
        async apply() {
          harness.events.push('record:apply')
          throw new Error('state write failed')
        },
        async commit() {
          harness.events.push('record:commit')
        },
        async rollback() {
          harness.events.push('record:rollback')
        },
      },
    })

    const outcome = await execute(harness.ports, undefined, adoptionHooks(harness.events))

    expect(outcome).toMatchObject({
      error: {
        code: 'recording-failed',
        phase: 'record',
        sideEffect: 'compensated',
      },
      kind: 'failed',
    })
    expect(harness.events).toContain('record:rollback')
    expect(harness.events).not.toContain('compensate')
    expect(harness.events).not.toContain('record:commit')
  })

  it('preserves committed adoption state and the external installation when cancellation crosses commit', async () => {
    const commitStarted = deferred<void>()
    const finishCommit = deferred<void>()
    const controller = new AbortController()
    const harness = createHarness({
      observations: [untrackedObservation(), untrackedObservation(), managedObservation()],
      record: {
        async apply() {
          harness.events.push('record:apply')
        },
        async commit() {
          harness.events.push('record:commit:start')
          commitStarted.resolve()
          await finishCommit.promise
          harness.events.push('record:commit:done')
        },
        async rollback() {
          harness.events.push('record:rollback')
        },
      },
    })

    const execution = invoke(harness.ports, { signal: controller.signal }, undefined, adoptionHooks(harness.events))
    await commitStarted.promise
    controller.abort('stop during commit')
    expect(await Promise.race([execution.then(() => 'settled'), Promise.resolve('pending')])).toBe('pending')

    finishCommit.resolve()
    const outcome = await execution

    expect(outcome).toMatchObject({
      error: {
        code: 'cancelled',
        details: { phase: 'record', reason: 'stop during commit', sideEffect: 'may-remain' },
      },
      kind: 'failure',
    })
    expect(harness.events).not.toContain('record:rollback')
    expect(harness.events).not.toContain('compensate')
    expect(harness.events).toContain('record:commit:done')
  })

  it('does not roll back state or uninstall the external resource after adoption commit rejects', async () => {
    const harness = createHarness({
      observations: [untrackedObservation(), untrackedObservation(), managedObservation()],
      record: {
        async apply() {
          harness.events.push('record:apply')
        },
        async commit() {
          harness.events.push('record:commit')
          throw new Error('state lock release failed')
        },
        async rollback() {
          harness.events.push('record:rollback')
        },
      },
    })

    const outcome = await execute(harness.ports, undefined, adoptionHooks(harness.events))

    expect(outcome).toMatchObject({
      error: {
        code: 'compensation-failed',
        originCode: 'recording-failed',
        phase: 'compensate',
        remediation: expect.stringContaining('Keep the installed resource in place'),
        sideEffect: 'may-remain',
      },
      kind: 'failed',
    })
    expect(outcome.kind === 'failed' ? outcome.error.remediation : undefined).not.toContain('remove')
    expect(harness.events).not.toContain('record:rollback')
    expect(harness.events).not.toContain('compensate')
  })

  it('rejects adoption state whose provider identity differs before any side effect', async () => {
    const harness = createHarness({ observations: [untrackedObservation()] })
    const hooks: CoreInstallationExecutionHooks = {
      async resolveAdoption() {
        harness.events.push('adoption:resolve')
        return { binding: npmBinding, installedState: installedStateFor(bunBinding) }
      },
    }

    const outcome = await execute(harness.ports, undefined, hooks)

    expect(outcome).toMatchObject({
      error: {
        code: 'decision-indeterminate',
        phase: 'decide',
        sideEffect: 'none',
      },
      kind: 'failed',
    })
    expect(harness.events).toEqual(['lock:acquire', 'observe:0', 'adoption:resolve', 'lock:release'])
  })

  it('rejects a preview adoption that conflicts with observed provider evidence', async () => {
    const harness = createHarness({ observations: [untrackedObservation()] })
    const hooks: CoreInstallationExecutionHooks = {
      async resolveAdoption() {
        harness.events.push('adoption:resolve')
        return { binding: bunBinding, installedState: installedStateFor(bunBinding) }
      },
    }

    const outcome = await execute(harness.ports, { mode: 'preview', name: agent.name, operation: 'ensure' }, hooks)

    expect(outcome).toMatchObject({
      error: {
        code: 'decision-indeterminate',
        reason: 'Compatibility adoption does not preserve the observed provider source.',
        sideEffect: 'none',
      },
      kind: 'failed',
    })
    expect(harness.events).toEqual(['observe:0', 'adoption:resolve'])
  })

  it('emits the mutation-start hook immediately before a provider install', async () => {
    const harness = createHarness({
      observations: [missingObservation(), untrackedObservation(), managedObservation()],
    })

    await execute(harness.ports, undefined, {
      onMutationStart(event) {
        harness.events.push(`mutation:start:${event.decision}`)
      },
    })

    expect(harness.events.indexOf('mutation:start:install')).toBe(harness.events.indexOf('install') - 1)
  })
})

interface HarnessOptions {
  readonly observations?: readonly (CoreAgentObservation | undefined)[]
  readonly overrides?: Partial<CoreInstallationExecutorPorts>
  readonly recipe?: CoreInstallationRecipe
  readonly record?: {
    apply(): Promise<void>
    commit(): Promise<void>
    rollback(): Promise<void>
  }
}

function createHarness(options: HarnessOptions = {}): {
  readonly events: string[]
  readonly ports: CoreInstallationExecutorPorts
  readonly prepared: Parameters<CoreInstallationExecutorPorts['prepareRecord']>[0][]
} {
  const events: string[] = []
  const prepared: Parameters<CoreInstallationExecutorPorts['prepareRecord']>[0][] = []
  const observations = options.observations ?? [missingObservation(), untrackedObservation(), managedObservation()]
  const recipe = options.recipe ?? npmRecipe
  const record =
    options.record ??
    ({
      async apply() {
        events.push('record:apply')
      },
      async commit() {
        events.push('record:commit')
      },
      async rollback() {
        events.push('record:rollback')
      },
    } satisfies HarnessOptions['record'])
  let observationIndex = 0

  const ports: CoreInstallationExecutorPorts = {
    async compensate(selected) {
      events.push('compensate')
      return successfulMutation(selected)
    },
    async install(selected) {
      events.push('install')
      return successfulMutation(selected)
    },
    async observe() {
      events.push(`observe:${observationIndex}`)
      const nextObservation = observations[Math.min(observationIndex, observations.length - 1)]
      observationIndex += 1
      return nextObservation
    },
    async prepareRecord(input) {
      events.push('record:prepare')
      prepared.push(input)
      return record
    },
    async resolveRecipe() {
      events.push('resolve')
      return { kind: 'ready', recipe }
    },
    async verify() {
      events.push('verify')
      return successfulVerification()
    },
    async withMutationLock<T>(_name: string, _context: unknown, run: () => Promise<T>): Promise<T> {
      events.push('lock:acquire')
      try {
        return await run()
      } finally {
        events.push('lock:release')
      }
    },
    ...options.overrides,
  }

  return { events, ports, prepared }
}

async function execute(
  ports: CoreInstallationExecutorPorts,
  request: Parameters<typeof executeCoreInstallation>[0] = {
    mode: 'apply',
    name: agent.name,
    operation: 'ensure',
  },
  hooks?: CoreInstallationExecutionHooks,
): Promise<CoreInstallationExecutionOutcome> {
  const invocation = await invoke(ports, undefined, request, hooks)
  if (invocation.kind === 'failure') throw new Error(`Unexpected invocation failure: ${invocation.error.code}`)
  return invocation.value
}

function invoke(
  ports: CoreInstallationExecutorPorts,
  options?: CoreRequestOptions,
  request: Parameters<typeof executeCoreInstallation>[0] = {
    mode: 'apply',
    name: agent.name,
    operation: 'ensure',
  },
  hooks?: CoreInstallationExecutionHooks,
) {
  return runCoreInvocation(options, context => executeCoreInstallation(request, context, ports, hooks))
}

function adoptionHooks(events: string[]): CoreInstallationExecutionHooks {
  return {
    onMutationStart(event) {
      events.push(`mutation:start:${event.decision}`)
    },
    async resolveAdoption() {
      events.push('adoption:resolve')
      return { binding: npmBinding, installedState: installedStateFor(npmBinding) }
    },
  }
}

function successfulMutation(recipe: CoreInstallationRecipe): ProviderOutcome<ProviderMutationEvidence> {
  return { kind: 'success', value: { evidence: [], target: recipe.binding.target } }
}

function successfulVerification(): ProviderOutcome<ProviderVerification> {
  return { kind: 'success', value: { evidence: [], kind: 'satisfied' } }
}

function missingObservation(): CoreAgentObservation {
  return observed(absent({ kind: 'none' }))
}

function managedObservation(
  observedAt = '2026-07-22T00:00:01.000Z',
  binding: LifecycleProviderBinding = npmBinding,
): CoreAgentObservation {
  return observed(present({ kind: 'none' }, observedAt, binding), {
    binding,
    installedState: installedStateFor(binding),
    persistedBinding: binding,
    receipt: receiptFor(binding, observedAt),
  })
}

function untrackedObservation(
  binding: LifecycleProviderBinding = npmBinding,
  observedAt = '2026-07-22T00:00:00.500Z',
): CoreAgentObservation {
  return observed(present({ kind: 'untracked' }, observedAt, binding), { binding })
}

function inconsistentManagedObservation(mismatch: 'final' | 'receipt' | 'state'): CoreAgentObservation {
  if (mismatch === 'final') return managedObservation('2026-07-22T00:00:02.000Z', bunBinding)

  const managed = managedObservation('2026-07-22T00:00:02.000Z')
  return mismatch === 'state'
    ? { ...managed, installedState: installedStateFor(bunBinding) }
    : { ...managed, receipt: receiptFor(bunBinding, '2026-07-22T00:00:02.000Z') }
}

function installedStateFor(binding: LifecycleProviderBinding): InstalledAgentState {
  return {
    agentName: agent.name,
    binaryName: agent.binaryName,
    installType: binding.providerId,
    packageName: binding.target.id,
  }
}

function receiptFor(binding: LifecycleProviderBinding, verifiedAt: string): LifecycleReceipt {
  return {
    executableName: agent.binaryName,
    executablePath: '/tmp/fixture-agent',
    kind: 'lifecycle-receipt',
    providerId: binding.providerId,
    providerTargetId: binding.target.id,
    providerTargetKind: binding.target.kind,
    schemaVersion: 1,
    targetId: agent.name,
    verifiedAt,
    version: '1.0.0',
  }
}

function observed(
  observation: LifecycleObservation,
  overrides: Partial<CoreAgentObservation> = {},
): CoreAgentObservation {
  const executable = {
    path: observation.kind === 'present' ? observation.executablePath : undefined,
    present: observation.kind === 'present',
    version: observation.kind === 'present' ? observation.version : undefined,
  }
  return {
    agent,
    capabilities: [],
    catalogMethods: [npmBinding],
    executable,
    methods: [{ type: 'npm' }],
    observation,
    pathExecutable: executable,
    ...overrides,
  }
}

function present(
  drift: LifecycleObservation['drift'],
  observedAt: string,
  binding: LifecycleProviderBinding = npmBinding,
): Extract<LifecycleObservation, { kind: 'present' }> {
  return {
    drift,
    executablePath: '/tmp/fixture-agent',
    kind: 'present',
    observedAt,
    providerId: binding.providerId,
    providerTargetId: binding.target.id,
    providerTargetKind: binding.target.kind,
    targetId: agent.name,
    version: '1.0.0',
  }
}

function absent(drift: LifecycleObservation['drift']): Extract<LifecycleObservation, { kind: 'absent' }> {
  return {
    drift,
    kind: 'absent',
    observedAt: '2026-07-22T00:00:00.000Z',
    targetId: agent.name,
  }
}

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return { promise, resolve }
}
