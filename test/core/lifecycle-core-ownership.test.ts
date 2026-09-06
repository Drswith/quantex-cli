import { readdir, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const keptLifecycleModules = [
  'src/lifecycle/agent-execution.ts',
  'src/lifecycle/agent-observation.ts',
  'src/lifecycle/index.ts',
  'src/lifecycle/model.ts',
  'src/lifecycle/provider-binding.ts',
  'src/lifecycle/provider-evidence.ts',
  'src/lifecycle/uninstall-postcondition.ts',
  'src/lifecycle/update-planner.ts',
] as const

describe('P8 lifecycle→Core closure', () => {
  it('keeps remaining lifecycle modules as differential domain outside src/core', async () => {
    for (const path of keptLifecycleModules) await source(path)

    const execution = await source('src/core/execution-executor.ts')
    expect(execution).toContain("from '../lifecycle'")
    expect(execution).toContain('planAgentExecutionPreflight')
    expect(execution).not.toContain('createQuantex')

    const observation = await source('src/core/production-observation.ts')
    expect(observation).toContain("from '../lifecycle/agent-observation'")
    expect(observation).toContain('observeAgentLifecycle')

    const updateProduction = await source('src/core/update-production.ts')
    expect(updateProduction).toContain("from '../lifecycle'")
    expect(updateProduction).toContain('planLifecycleUpdate')
    expect(updateProduction).toContain("from '../lifecycle/agent-observation'")
    expect(updateProduction).toContain("from '../lifecycle/provider-binding'")

    const uninstall = await source('src/core/uninstall-executor.ts')
    expect(uninstall).toContain("from '../lifecycle/uninstall-postcondition'")
    expect(uninstall).toContain('waitForUninstallAbsence')
    expect(uninstall).toContain('observeLifecycleProvider')

    const stateSchema = await source('src/state/schema.ts')
    expect(stateSchema).toContain("from '../lifecycle/model'")
    expect(stateSchema).not.toMatch(/from ['"]\.\.\/core/u)

    const planning = await source('src/planning/updates.ts')
    expect(planning).toContain("from '../lifecycle/update-planner'")
    expect(planning).toContain('planLifecycleUpdate')
  })

  it('does not publish lifecycle engines on the Core SDK surface', async () => {
    const publicCore = await source('src/core/index.ts')
    expect(publicCore).not.toContain('observeAgentLifecycle')
    expect(publicCore).not.toContain('planLifecycleUpdate')
    expect(publicCore).not.toContain('waitForUninstallAbsence')
    expect(publicCore).not.toContain('planAgentExecutionPreflight')
    expect(publicCore).not.toContain('observeLifecycleProvider')
    expect(publicCore).not.toContain('../lifecycle')

    const packageEntry = await source('packages/core/src/index.ts')
    expect(packageEntry).not.toContain('observeAgentLifecycle')
    expect(packageEntry).not.toContain('planLifecycleUpdate')
    expect(packageEntry).not.toContain('../lifecycle')
  })

  it('keeps provider-evidence as observation plus binding re-exports, not a leftover pass-through', async () => {
    const evidence = await source('src/lifecycle/provider-evidence.ts')
    expect(evidence).toContain('observeLifecycleProvider')
    expect(evidence).toContain('firstPartyProviderRegistry')
    expect(evidence).toContain("from './provider-binding'")

    await expect(source('src/lifecycle/shadow-planning.ts')).rejects.toThrow()

    const entries = await readdir(new URL('../../src/lifecycle', import.meta.url))
    expect(entries.filter(name => name.endsWith('.ts')).sort()).toEqual([
      'agent-execution.ts',
      'agent-observation.ts',
      'index.ts',
      'model.ts',
      'provider-binding.ts',
      'provider-evidence.ts',
      'uninstall-postcondition.ts',
      'update-planner.ts',
    ])
  })
})

async function source(path: string): Promise<string> {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
}
