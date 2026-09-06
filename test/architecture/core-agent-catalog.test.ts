import type { AgentDefinition } from '../../src/agents/types'
import { describe, expect, it } from 'vitest'
import { getAllAgents } from '../../src/agents'
import { coreAgentCatalog } from '../../src/core/generated/agent-catalog'

describe('Core read-only agent catalog', () => {
  it('stays equivalent to the maintained catalog without mutation-only metadata', () => {
    expect(coreAgentCatalog).toEqual(getAllAgents().map(projectCoreAgent))
    expect(coreAgentCatalog.every(agent => agent.selfUpdate === undefined)).toBe(true)
  })
})

function projectCoreAgent(agent: AgentDefinition): AgentDefinition {
  return {
    binaryName: agent.binaryName,
    displayName: agent.displayName,
    homepage: agent.homepage,
    ...(agent.lookupAliases?.length ? { lookupAliases: [...agent.lookupAliases] } : {}),
    name: agent.name,
    ...(agent.packages ? { packages: { ...agent.packages } } : {}),
    platforms: Object.fromEntries(
      Object.entries(agent.platforms).map(([platform, methods]) => [
        platform,
        methods?.map(method => ({
          ...(method.binaryName ? { binaryName: method.binaryName } : {}),
          ...(method.command ? { command: method.command } : {}),
          ...(method.packageInstallArgs ? { packageInstallArgs: [...method.packageInstallArgs] } : {}),
          ...(method.packageName ? { packageName: method.packageName } : {}),
          ...(method.packageTargetKind ? { packageTargetKind: method.packageTargetKind } : {}),
          type: method.type,
        })),
      ]),
    ) as AgentDefinition['platforms'],
    ...(agent.versionProbe ? { versionProbe: { command: agent.versionProbe.command } } : {}),
  }
}
