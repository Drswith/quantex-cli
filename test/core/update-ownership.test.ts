import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('CLI Core update ownership', () => {
  it('routes update through in-repo Core without a public SDK update()', async () => {
    const updateFacade = await source('src/commands/update.ts')
    expect(updateFacade).toContain("from '../core/update-executor'")
    expect(updateFacade).toContain("from '../services/lifecycle-updates-production'")
    expect(updateFacade).not.toContain('createQuantex')
    expect(updateFacade).not.toMatch(/from ['"]quantex-core['"]/u)
    expect(updateFacade).not.toMatch(/from ['"][^'"]*services\/lifecycle-updates['"]/u)
    expect(updateFacade).toContain("from '../services/lifecycle-updates-production'")

    const productionBridge = await source('src/services/lifecycle-updates-production.ts')
    expect(productionBridge).toContain("from '../core/update-compatibility'")
    expect(productionBridge).toContain('createCoreSingleAgentUpdateInvocation')
    expect(productionBridge).toContain('createCoreUpdateBatchInvocation')
    expect(productionBridge).not.toContain('createProductionLifecycleObservationService')
    expect(productionBridge).not.toContain('executeSingleAgentLifecycleUpdate')
    expect(productionBridge).not.toContain('planSingleAgentLifecycleUpdate')
    expect(productionBridge).not.toContain('createQuantex')
    expect(productionBridge).not.toMatch(/from ['"]quantex-core['"]/u)

    const coreCompatibility = await source('src/core/update-compatibility.ts')
    expect(coreCompatibility).toContain('createCoreSingleAgentUpdateInvocation')
    expect(coreCompatibility).toContain("from './update-production'")
    expect(coreCompatibility).not.toContain('cli-context')
    expect(coreCompatibility).not.toContain('createQuantex')

    const publicCore = await source('src/core/index.ts')
    expect(publicCore).not.toContain('update-executor')
    expect(publicCore).not.toContain('update-compatibility')
    expect(publicCore).not.toContain('update-production')

    const packageEntry = await source('packages/core/src/index.ts')
    expect(packageEntry).not.toContain('update-executor')
    expect(packageEntry).not.toContain('update-compatibility')
  })

  it('does not retain deprecated Core re-export shims under services', async () => {
    await expect(source('src/services/lifecycle-updates.ts')).rejects.toThrow()
    await expect(source('src/services/lifecycle-execution.ts')).rejects.toThrow()
  })
})

async function source(path: string): Promise<string> {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
}
