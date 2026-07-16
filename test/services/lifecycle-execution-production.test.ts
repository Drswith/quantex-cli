import type { AgentDefinition } from '../../src/agents'
import type { LifecycleObservationService } from '../../src/services/lifecycle-observations'
import { describe, expect, it, vi } from 'vitest'
import {
  createProductionLifecycleExecutionService,
  type ProductionLifecycleExecutionDependencies,
} from '../../src/services/lifecycle-execution-production'

describe('createProductionLifecycleExecutionService', () => {
  it('uses the PATH executable and disables latest-version resolution for preflight', async () => {
    const observationService = serviceWithObservations([resolvedObservation(false, true)])
    const dependencies = fakeDependencies(observationService)
    const service = createProductionLifecycleExecutionService(options(), dependencies)

    await expect(
      service.execute({ agentName: 'test-agent', args: ['--help'], installPolicy: 'never' }),
    ).resolves.toMatchObject({ kind: 'not-installed' })
    expect(dependencies.createObservationService).toHaveBeenCalledWith(expect.anything(), {
      resolveLatestVersion: false,
    })
    expect(dependencies.createProcessPort().run).not.toHaveBeenCalled()
    service.dispose()
  })

  it('adapts verified installation reconciliation before re-observation and launch', async () => {
    const observationService = serviceWithObservations([resolvedObservation(false), resolvedObservation(true)])
    const dependencies = fakeDependencies(observationService)
    const service = createProductionLifecycleExecutionService(options(), dependencies)

    await expect(
      service.execute({ agentName: 'test-agent', args: ['--help'], installPolicy: 'if-missing' }),
    ).resolves.toMatchObject({ exitCode: 0, kind: 'exited' })
    expect(dependencies.reconcileAgentInstallation).toHaveBeenCalledWith({
      agent: testAgent,
      observation: expect.objectContaining({ inPath: false }),
      operation: 'install',
      route: 'install',
    })
    expect(dependencies.createProcessPort().run).toHaveBeenCalledWith(
      expect.objectContaining({ argv: ['test-bin', '--help'] }),
    )
    service.dispose()
  })
})

function fakeDependencies(observationService: LifecycleObservationService): ProductionLifecycleExecutionDependencies {
  const processPort = { run: vi.fn(async () => ({ kind: 'success' as const, value: { exitCode: 0 } })) }
  return {
    cancelOperations: vi.fn(async () => undefined),
    createObservationService: vi.fn(() => observationService),
    createOperationContext: vi.fn(() => ({
      context: {
        registerCleanup: () => () => undefined,
        signal: new AbortController().signal,
        timeoutMs: 5_000,
      },
      dispose: vi.fn(),
      run: vi.fn(),
    })),
    createProcessPort: vi.fn(() => processPort),
    reconcileAgentInstallation: vi.fn(
      async () =>
        ({
          kind: 'success' as const,
          value: {
            changed: true,
            receipt: {
              kind: 'lifecycle-receipt' as const,
              providerId: 'npm',
              providerTargetId: 'test-package',
              providerTargetKind: 'package' as const,
              schemaVersion: 1 as const,
              targetId: 'test-agent',
              verifiedAt: '2026-07-15T08:00:00.000Z',
            },
            value: {
              installedState: {
                agentName: 'test-agent',
                installType: 'npm' as const,
                packageName: 'test-package',
              },
            },
            verification: {
              kind: 'satisfied' as const,
              observation: {
                drift: { kind: 'none' as const },
                kind: 'present' as const,
                targetId: 'test-agent',
              },
              postcondition: { executable: 'test-bin', kind: 'executable-present' as const },
            },
          },
        }) as const,
    ) as unknown as ProductionLifecycleExecutionDependencies['reconcileAgentInstallation'],
  }
}

function serviceWithObservations(
  observations: Array<ReturnType<typeof resolvedObservation>>,
): LifecycleObservationService {
  return {
    observeRegisteredAgents: vi.fn(async () => []),
    resolveAgentObservation: vi.fn(async () => observations.shift()),
  }
}

function resolvedObservation(pathPresent: boolean, providerPresent = pathPresent) {
  const pathExecutable = pathPresent ? { path: '/path/test-bin', present: true, version: '1.0.0' } : { present: false }
  return {
    agent: testAgent,
    capabilities: [],
    catalogMethods: [],
    executable: providerPresent ? { path: '/provider/test-bin', present: true, version: '1.0.0' } : { present: false },
    latestVersion: undefined,
    methods: [{ packageName: 'test-package', type: 'npm' as const }],
    observation: providerPresent
      ? {
          drift: { kind: 'untracked' as const },
          executablePath: '/provider/test-bin',
          kind: 'present' as const,
          targetId: 'test-agent',
        }
      : {
          drift: { kind: 'none' as const },
          kind: 'absent' as const,
          targetId: 'test-agent',
        },
    pathExecutable,
    resolvedBinaryPath: pathPresent ? '/path/test-bin' : undefined,
  }
}

function options() {
  return {
    confirmInstall: vi.fn(async () => true),
    dryRun: false,
    interactive: false,
    outputMode: 'human' as const,
    timeoutMs: 5_000,
  }
}

const testAgent: AgentDefinition = {
  binaryName: 'test-bin',
  displayName: 'Test Agent',
  homepage: 'https://example.com',
  name: 'test-agent',
  packages: { npm: 'test-package' },
  platforms: { linux: [{ packageName: 'test-package', type: 'npm' }] },
}
