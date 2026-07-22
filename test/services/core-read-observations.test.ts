import type { AgentDefinition } from '../../src/agents'
import type { CoreBackedCliReadDependencies } from '../../src/services/core-read-observations'
import type { CoreAgentObservation, CoreReadPorts } from '@quantex/core/internal'
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { createCoreBackedCliReadObservationService } from '../../src/services/core-read-observations'

const firstAgent = agent('alpha')
const secondAgent = agent('beta')

describe('Core-backed CLI read observations', () => {
  it('resolves an agent through Core and adds only the v1 latest-version projection', async () => {
    const inspection = observed(firstAgent)
    const inspectAgent = vi.fn(async () => inspection)
    const resolveLatestVersion = vi.fn(async () => '2.0.0')
    const service = createCoreBackedCliReadObservationService(
      context(125),
      dependencies({
        core: { inspectAgent, listAgents: vi.fn(async () => [firstAgent]) },
        resolveLatestVersion,
      }),
    )

    const result = await service.resolveAgentObservation('a')

    expect(inspectAgent).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ configDir: '/isolated/quantex', signal: expect.any(AbortSignal), timeoutMs: 125 }),
    )
    expect(resolveLatestVersion).toHaveBeenCalledWith(
      firstAgent,
      inspection.installedState,
      inspection.methods,
      expect.objectContaining({ signal: expect.any(AbortSignal), timeoutMs: 125 }),
    )
    expect(result).toMatchObject({ agent: firstAgent, latestVersion: '2.0.0', observation: inspection.observation })
  })

  it('keeps Core registry order and inspects every listed agent through the same read boundary', async () => {
    const inspectAgent = vi.fn(async (name: string) =>
      name === firstAgent.name ? observed(firstAgent) : observed(secondAgent),
    )
    const listAgents = vi.fn(async () => [secondAgent, firstAgent])
    const service = createCoreBackedCliReadObservationService(
      context(),
      dependencies({ core: { inspectAgent, listAgents } }),
    )

    const results = await service.observeRegisteredAgents()

    expect(listAgents).toHaveBeenCalledOnce()
    expect(inspectAgent.mock.calls.map(([name]) => name)).toEqual(['beta', 'alpha'])
    expect(results.map(result => result.agent.name)).toEqual(['beta', 'alpha'])
  })

  it('waits for Core cleanup before surfacing CLI cancellation', async () => {
    const controller = new AbortController()
    const cleanup = vi.fn(async () => undefined)
    let signalStarted!: () => void
    const started = new Promise<void>(resolve => {
      signalStarted = resolve
    })
    const inspectAgent: CoreReadPorts['inspectAgent'] = vi.fn(async (_name, invocation) => {
      invocation.registerCleanup({ cleanup })
      signalStarted()
      return new Promise<CoreAgentObservation | undefined>(() => undefined)
    })
    const service = createCoreBackedCliReadObservationService(
      { signal: controller.signal },
      dependencies({ core: { inspectAgent, listAgents: vi.fn(async () => [firstAgent]) } }),
    )

    const pending = service.resolveAgentObservation('alpha')
    await started
    controller.abort('test cancellation')

    await expect(pending).rejects.toMatchObject({ kind: 'cancelled', reason: 'test cancellation' })
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('routes only maintained read commands through Core while mutation commands stay on the legacy boundary', async () => {
    for (const path of ['doctor', 'info', 'inspect', 'list', 'resolve']) {
      expect(await source(`src/commands/${path}.ts`)).toContain("from '../services/core-read-observations'")
    }
    for (const path of ['ensure', 'install']) {
      const contents = await source(`src/commands/${path}.ts`)
      expect(contents).toContain("from '../services/lifecycle-observations'")
      expect(contents).not.toContain('core-read-observations')
    }

    const adapter = await source('src/services/core-read-observations.ts')
    expect(adapter).toContain("from '@quantex/core/internal'")
    expect(adapter).not.toMatch(/from ['"]\.\.\/core\//u)
    expect(adapter).not.toContain('createProductionLifecycleObservationService')
    expect(adapter).not.toContain('fallback')
    expect(adapter).not.toContain('shadow')
  })
})

function dependencies(
  overrides: Partial<CoreBackedCliReadDependencies> & Pick<CoreBackedCliReadDependencies, 'core'>,
): CoreBackedCliReadDependencies {
  return {
    configDir: '/isolated/quantex',
    resolveLatestVersion: vi.fn(async () => undefined),
    ...overrides,
  }
}

function context(timeoutMs?: number) {
  return {
    signal: new AbortController().signal,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  }
}

function agent(name: string): AgentDefinition {
  return {
    binaryName: `${name}-bin`,
    displayName: name,
    homepage: 'https://example.com',
    lookupAliases: [name[0] ?? name],
    name,
    packages: { npm: `${name}-package` },
    platforms: { linux: [{ packageName: `${name}-package`, type: 'bun' }] },
  }
}

function observed(target: AgentDefinition): CoreAgentObservation {
  const executable = { path: `/bin/${target.binaryName}`, present: true as const, version: '1.0.0' }
  return {
    agent: target,
    capabilities: [],
    catalogMethods: [],
    executable,
    methods: target.platforms.linux ?? [],
    observation: {
      drift: { kind: 'untracked' },
      executablePath: executable.path,
      kind: 'present',
      observedAt: '2026-07-22T00:00:00.000Z',
      targetId: target.name,
      version: executable.version,
    },
    pathExecutable: executable,
    resolvedBinaryPath: executable.path,
  }
}

async function source(path: string): Promise<string> {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
}
