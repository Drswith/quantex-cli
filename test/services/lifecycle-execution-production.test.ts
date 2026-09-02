import type { AgentDefinition } from '../../src/agents'
import type { CoreInstallationCompatibilityExecutor } from '../../src/core/installation-compatibility'
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
    expect(dependencies.createInstallationExecutor().execute).not.toHaveBeenCalled()
    service.dispose()
  })

  it('adapts Core install/ensure before re-observation and launch', async () => {
    const observationService = serviceWithObservations([resolvedObservation(false), resolvedObservation(true)])
    const dependencies = fakeDependencies(observationService)
    const service = createProductionLifecycleExecutionService(options(), dependencies)

    await expect(
      service.execute({ agentName: 'test-agent', args: ['--help'], installPolicy: 'if-missing' }),
    ).resolves.toMatchObject({ exitCode: 0, kind: 'exited' })
    expect(dependencies.createInstallationExecutor().execute).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'apply',
        name: 'test-agent',
        operation: 'install',
        outputPolicy: 'inherit',
      }),
    )
    expect(dependencies.createProcessPort().run).toHaveBeenCalledWith(
      expect.objectContaining({
        argv: ['/path/test-bin', '--help'],
        stdio: ['inherit', 'inherit', 'inherit'],
      }),
    )
    service.dispose()
  })

  it('supplies structured stdio policy from the CLI output mode without a public SDK run()', async () => {
    const observationService = serviceWithObservations([resolvedObservation(true)])
    const dependencies = fakeDependencies(observationService)
    const service = createProductionLifecycleExecutionService(options({ outputMode: 'json' }), dependencies)

    await expect(service.execute({ agentName: 'test-agent', args: [], installPolicy: 'never' })).resolves.toMatchObject(
      { exitCode: 0, kind: 'exited' },
    )
    expect(dependencies.createProcessPort().run).toHaveBeenCalledWith(
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }),
    )
    service.dispose()
  })

  it('freezes human interactive agent launch on inherited stdin/stdout/stderr', async () => {
    const observationService = serviceWithObservations([resolvedObservation(true)])
    const dependencies = fakeDependencies(observationService)
    const service = createProductionLifecycleExecutionService(options({ outputMode: 'human' }), dependencies)

    await expect(
      service.execute({ agentName: 'test-agent', args: ['repl'], installPolicy: 'never' }),
    ).resolves.toMatchObject({ exitCode: 0, kind: 'exited' })
    expect(dependencies.createProcessPort().run).toHaveBeenCalledWith({
      argv: ['/path/test-bin', 'repl'],
      signal: expect.any(AbortSignal),
      stdio: ['inherit', 'inherit', 'inherit'],
      timeoutMs: 5_000,
    })
    service.dispose()
  })

  it('does not import reconcileAgentInstallation after Core install routing', async () => {
    const source = await import('node:fs/promises').then(fs =>
      fs.readFile(new URL('../../src/services/lifecycle-execution-production.ts', import.meta.url), 'utf8'),
    )
    expect(source).toContain('createCoreInstallationCompatibilityExecutor')
    expect(source).toContain("from '../core/installation-compatibility'")
    expect(source).not.toContain('reconcileAgentInstallation')
  })
})

function fakeDependencies(observationService: LifecycleObservationService): ProductionLifecycleExecutionDependencies {
  const processPort = { run: vi.fn(async () => ({ kind: 'success' as const, value: { exitCode: 0 } })) }
  const installationExecutor: CoreInstallationCompatibilityExecutor = {
    execute: vi.fn(async () => ({
      kind: 'success' as const,
      value: {
        kind: 'success' as const,
        value: {
          after: {
            agent: testAgent,
            binding: undefined,
            capabilities: [],
            catalogMethods: [],
            executable: { path: '/path/test-bin', present: true, version: '1.0.0' },
            methods: [{ packageName: 'test-package', type: 'npm' as const }],
            observation: {
              drift: { kind: 'none' as const },
              kind: 'present' as const,
              targetId: 'test-agent',
            },
            pathExecutable: { path: '/path/test-bin', present: true, version: '1.0.0' },
          },
          before: {
            agent: testAgent,
            binding: undefined,
            capabilities: [],
            catalogMethods: [],
            executable: { present: false },
            methods: [{ packageName: 'test-package', type: 'npm' as const }],
            observation: {
              drift: { kind: 'none' as const },
              kind: 'absent' as const,
              targetId: 'test-agent',
            },
            pathExecutable: { present: false },
          },
          changed: true,
          decision: 'install' as const,
          kind: 'apply' as const,
        },
      },
    })),
  }
  return {
    cancelOperations: vi.fn(async () => undefined),
    createInstallationExecutor: vi.fn(() => installationExecutor),
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

function options(
  overrides: Partial<{
    confirmInstall: () => Promise<boolean>
    dryRun: boolean
    interactive: boolean
    outputMode: 'human' | 'json' | 'ndjson'
    timeoutMs: number
  }> = {},
) {
  return {
    confirmInstall: vi.fn(async () => true),
    dryRun: false,
    interactive: false,
    outputMode: 'human' as 'human' | 'json' | 'ndjson',
    timeoutMs: 5_000,
    ...overrides,
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
