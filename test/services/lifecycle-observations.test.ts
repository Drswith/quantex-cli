import type { AgentDefinition, InstallMethod } from '../../src/agents'
import type { AgentLifecycleObservationPorts, AgentLifecycleObservationResult } from '../../src/lifecycle'
import type { InstalledAgentState } from '../../src/state'
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import * as legacyAgentsService from '../../src/services/agents'
import {
  createLifecycleObservationService,
  createProductionLifecycleObservationService,
  observeRegisteredAgents,
  resolveAgentObservation,
} from '../../src/services/lifecycle-observations'

const firstAgent = agent('alpha', ['a'])
const secondAgent = agent('beta', ['b'])

describe('lifecycle observation application service', () => {
  it('resolves aliases to the canonical agent and observes it once', async () => {
    const observe = vi.fn(async (target: AgentDefinition) => observation(target))
    const service = createLifecycleObservationService(
      ports({
        getAgentByNameOrAlias: name => (name === 'a' ? firstAgent : undefined),
        observeAgentLifecycle: observe,
      }),
    )

    const result = await service.resolveAgentObservation('a')

    expect(result?.agent).toBe(firstAgent)
    expect(result?.observation.targetId).toBe('alpha')
    expect(observe).toHaveBeenCalledTimes(1)
    expect(observe).toHaveBeenCalledWith(firstAgent, expect.objectContaining({ providerRegistry: expect.anything() }))
  })

  it('returns undefined for an unknown agent without observing providers or state', async () => {
    const observe = vi.fn(async (target: AgentDefinition) => observation(target))
    const readInstalledState = vi.fn(async () => undefined)
    const readReceipt = vi.fn(async () => undefined)
    const service = createLifecycleObservationService(
      ports({
        getAgentByNameOrAlias: () => undefined,
        observeAgentLifecycle: observe,
        readInstalledState,
        readReceipt,
      }),
    )

    await expect(service.resolveAgentObservation('unknown')).resolves.toBeUndefined()
    expect(observe).not.toHaveBeenCalled()
    expect(readInstalledState).not.toHaveBeenCalled()
    expect(readReceipt).not.toHaveBeenCalled()
  })

  it('observes every registered agent once in canonical registry order', async () => {
    const observed: string[] = []
    const service = createLifecycleObservationService(
      ports({
        getAllAgents: () => [secondAgent, firstAgent],
        observeAgentLifecycle: async target => {
          observed.push(target.name)
          return observation(target)
        },
      }),
    )

    const results = await service.observeRegisteredAgents()

    expect(results.map(result => result.agent.name)).toEqual(['beta', 'alpha'])
    expect(observed).toEqual(['beta', 'alpha'])
  })

  it('shares one installed-state read with executable inspection', async () => {
    const installedState = { agentName: 'alpha', installType: 'bun' as const, packageName: 'alpha-package' }
    const readInstalledState = vi.fn(async () => installedState)
    const inspectExecutable = vi.fn(async (_target: AgentDefinition, state: InstalledAgentState | undefined) => ({
      present: true,
      version: state?.packageName,
    }))
    const service = createLifecycleObservationService(
      ports({
        getAgentByNameOrAlias: () => firstAgent,
        inspectExecutable,
        observeAgentLifecycle: async (target, observationPorts) => {
          const [executable, state] = await Promise.all([
            observationPorts.inspectExecutable(target),
            observationPorts.readInstalledState(target.name),
          ])
          return { ...observation(target), executable, installedState: state }
        },
        readInstalledState,
      }),
    )

    const result = await service.resolveAgentObservation('alpha')

    expect(result?.executable.version).toBe('alpha-package')
    expect(inspectExecutable).toHaveBeenCalledWith(firstAgent, installedState)
    expect(readInstalledState).toHaveBeenCalledTimes(1)
  })

  it('resolves the v1 binary path from raw PATH evidence instead of merged provider evidence', async () => {
    const getResolvedBinaryPath = vi.fn(async (path?: string) => path)
    const service = createLifecycleObservationService(
      ports({
        getAgentByNameOrAlias: () => firstAgent,
        getResolvedBinaryPath,
        observeAgentLifecycle: async target => ({
          ...observation(target),
          executable: { path: '/provider/alpha-bin', present: true, version: '2.0.0' },
          pathExecutable: { path: '/path/alpha-bin', present: true, version: '1.0.0' },
        }),
      }),
    )

    const result = await service.resolveAgentObservation('alpha')

    expect(getResolvedBinaryPath).toHaveBeenCalledWith('/path/alpha-bin')
    expect(result?.resolvedBinaryPath).toBe('/path/alpha-bin')
  })

  it('exposes production entry points without routing through legacy inspection', async () => {
    expect(typeof createProductionLifecycleObservationService).toBe('function')
    expect(typeof resolveAgentObservation).toBe('function')
    expect(typeof observeRegisteredAgents).toBe('function')
    expect(legacyAgentsService.resolveAgentInspection).toBeTypeOf('function')
    expect(legacyAgentsService.inspectRegisteredAgents).toBeTypeOf('function')
  })
})

describe('legacy mutation and execution boundary', () => {
  it('keeps legacy exports and callers on services/agents', async () => {
    const agentsSource = await source('src/services/agents.ts')
    expect(agentsSource).toContain('export async function resolveAgentInspection')
    expect(agentsSource).toContain('export async function inspectRegisteredAgents')
    expect(agentsSource).not.toContain("from './lifecycle-observations'")

    const expectedRoutes = {
      'src/commands/ensure.ts': { exports: ['resolveAgent', 'resolveAgentInspection'], route: '../services/agents' },
      'src/commands/install.ts': { exports: ['resolveAgent', 'resolveAgentInspection'], route: '../services/agents' },
      'src/commands/run.ts': { exports: ['resolveAgentInspection'], route: '../services/agents' },
      'src/commands/update.ts': { exports: ['resolveAgent'], route: '../services/agents' },
      'src/services/update.ts': { exports: ['inspectRegisteredAgents'], route: './agents' },
    }

    for (const [path, expected] of Object.entries(expectedRoutes)) {
      const contents = await source(path)
      expect(contents).toContain(`from '${expected.route}'`)
      expect(contents).not.toContain('lifecycle-observations')
      for (const exportName of expected.exports) expect(contents).toContain(exportName)
    }
  })

  it('keeps the new application boundary read-only and presenter-independent', async () => {
    const serviceSource = await source('src/services/lifecycle-observations.ts')
    const projectionSource = await source('src/compatibility/agent-inspection.ts')

    for (const contents of [serviceSource, projectionSource]) {
      expect(contents).not.toMatch(/from ['"]\.\.\/output/)
      expect(contents).not.toMatch(/from ['"]\.\.\/commands/)
    }
    expect(serviceSource).not.toMatch(/\b(?:saveState|setInstalledAgentState|removeInstalledAgentState)\b/)
    expect(serviceSource).not.toContain('withAgentLifecycleLock')
  })
})

function ports(
  overrides: Partial<Parameters<typeof createLifecycleObservationService>[0]> = {},
): Parameters<typeof createLifecycleObservationService>[0] {
  return {
    clock: () => '2026-07-12T08:00:00.000Z',
    getAllAgents: () => [firstAgent, secondAgent],
    getAgentByNameOrAlias: name => [firstAgent, secondAgent].find(target => target.name === name),
    getLatestVersion: async () => '2.0.0',
    getOrderedInstallMethods: async target => [...(target.platforms.linux ?? [])],
    getPlatform: () => 'linux',
    getResolvedBinaryPath: async path => path,
    inspectExecutable: async target => ({ path: `/bin/${target.binaryName}`, present: true, version: '1.0.0' }),
    observeAgentLifecycle: async target => observation(target),
    providerRegistry: {
      get: () => undefined,
      getCapabilities: () => [],
      list: () => [],
    },
    readInstalledState: async () => undefined,
    readReceipt: async () => undefined,
    signal: new AbortController().signal,
    ...overrides,
  }
}

function observation(target: AgentDefinition): AgentLifecycleObservationResult {
  const executable = { path: `/bin/${target.binaryName}`, present: true, version: '1.0.0' }

  return {
    capabilities: [],
    catalogMethods: [],
    executable,
    observation: {
      drift: { kind: 'untracked' },
      executablePath: `/bin/${target.binaryName}`,
      kind: 'present',
      targetId: target.name,
      version: '1.0.0',
    },
    pathExecutable: executable,
  }
}

function agent(name: string, lookupAliases: string[]): AgentDefinition {
  return {
    binaryName: `${name}-bin`,
    displayName: name.toUpperCase(),
    homepage: 'https://example.com',
    lookupAliases,
    name,
    packages: { npm: `${name}-package` },
    platforms: { linux: [{ packageName: `${name}-package`, type: 'bun' } satisfies InstallMethod] },
  }
}

async function source(path: string): Promise<string> {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
}
