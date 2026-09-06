import { readdir, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const keptLifecycleModules = [
  'src/lifecycle/agent-execution.ts',
  'src/lifecycle/agent-observation.ts',
  'src/lifecycle/index.ts',
  'src/lifecycle/provider-binding.ts',
  'src/lifecycle/provider-evidence.ts',
  'src/lifecycle/uninstall-postcondition.ts',
  'src/lifecycle/update-planner.ts',
] as const

const coreInternalModel = 'src/core/lifecycle/model.ts'
const stateCoreLeafImport = "from '../core/lifecycle/model'"

describe('P8 lifecycle→Core closure', () => {
  it('keeps remaining lifecycle engines as differential domain outside src/core', async () => {
    for (const path of keptLifecycleModules) await source(path)

    const execution = await source('src/core/execution-executor.ts')
    expect(execution).toContain("from '../lifecycle'")
    expect(execution).toContain('planAgentExecutionPreflight')
    expect(execution).toContain("from './lifecycle/model'")
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
    expect(uninstall).toContain("from './lifecycle/model'")

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
    expect(publicCore).not.toContain('./lifecycle')
    expect(publicCore).not.toContain('LifecycleReceipt')
    expect(publicCore).not.toContain('LIFECYCLE_RECEIPT_SCHEMA_VERSION')

    const packageEntry = await source('packages/core/src/index.ts')
    expect(packageEntry).not.toContain('observeAgentLifecycle')
    expect(packageEntry).not.toContain('planLifecycleUpdate')
    expect(packageEntry).not.toContain('../lifecycle')
    expect(packageEntry).not.toContain('LifecycleReceipt')
    expect(packageEntry).not.toContain('LIFECYCLE_RECEIPT_SCHEMA_VERSION')
  })

  it('keeps provider-evidence as observation plus binding re-exports, not a leftover pass-through', async () => {
    const evidence = await source('src/lifecycle/provider-evidence.ts')
    expect(evidence).toContain('observeLifecycleProvider')
    expect(evidence).toContain('firstPartyProviderRegistry')
    expect(evidence).toContain("from './provider-binding'")

    await expect(source('src/lifecycle/shadow-planning.ts')).rejects.toThrow()
    await expect(source('src/lifecycle/model.ts')).rejects.toThrow()

    const entries = await readdir(new URL('../../src/lifecycle', import.meta.url))
    expect(entries.filter(name => name.endsWith('.ts')).sort()).toEqual([
      'agent-execution.ts',
      'agent-observation.ts',
      'index.ts',
      'provider-binding.ts',
      'provider-evidence.ts',
      'uninstall-postcondition.ts',
      'update-planner.ts',
    ])
  })
})

describe('L1 lifecycle model Core-internal leaf', () => {
  it('owns receipt types in src/core/lifecycle/model without Core runtime imports', async () => {
    const model = await source(coreInternalModel)
    expect(model).toContain('export interface LifecycleReceipt')
    expect(model).toContain('export const LIFECYCLE_RECEIPT_SCHEMA_VERSION')
    expect(model).not.toMatch(/\bfrom ['"]/u)

    const coreLifecycleEntries = await readdir(new URL('../../src/core/lifecycle', import.meta.url))
    expect(coreLifecycleEntries.filter(name => name.endsWith('.ts')).sort()).toEqual(['model.ts'])
  })

  it('lets state import only the Core-internal leaf, not Core runtime', async () => {
    const stateFiles = ['src/state/schema.ts', 'src/state/store.ts', 'src/state/index.ts'] as const
    for (const path of stateFiles) {
      const text = await source(path)
      expect(text).toContain(stateCoreLeafImport)
      expect(text).not.toContain("from '../lifecycle/model'")
      const coreImports = [...text.matchAll(/from ['"](\.\.\/core[^'"]*)['"]/gu)].map(match => match[1])
      expect(coreImports).toEqual(['../core/lifecycle/model'])
      expect(text).not.toContain('createQuantex')
      expect(text).not.toContain('../core/index')
    }

    const schema = await source('src/state/schema.ts')
    expect(schema).toContain('export { LIFECYCLE_RECEIPT_SCHEMA_VERSION }')
  })

  it('retargets former lifecycle/model importers onto the Core-internal leaf', async () => {
    const installation = await source('src/core/installation-production.ts')
    expect(installation).toContain("from './lifecycle/model'")
    expect(installation).not.toContain("from '../lifecycle/model'")

    const stateRecord = await source('src/core/installation-state-record.ts')
    expect(stateRecord).toContain("from './lifecycle/model'")

    const packageManager = await source('src/package-manager/index.ts')
    expect(packageManager).toContain("from '../core/lifecycle/model'")
    expect(packageManager).not.toContain("from '../lifecycle/model'")

    const barrel = await source('src/lifecycle/index.ts')
    expect(barrel).toContain("from '../core/lifecycle/model'")

    const remaining = [
      'src/lifecycle/agent-observation.ts',
      'src/lifecycle/agent-execution.ts',
      'src/lifecycle/provider-binding.ts',
      'src/lifecycle/update-planner.ts',
    ] as const
    for (const path of remaining) {
      const text = await source(path)
      expect(text).toContain("from '../core/lifecycle/model'")
      expect(text).not.toContain("from './model'")
    }
  })
})

async function source(path: string): Promise<string> {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
}
