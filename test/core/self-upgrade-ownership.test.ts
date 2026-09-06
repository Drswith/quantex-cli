import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('CLI Core self-upgrade ownership', () => {
  it('routes upgrade plan/check/apply through in-repo Core without a public SDK upgrade()', async () => {
    const upgradeFacade = await source('src/commands/upgrade.ts')
    expect(upgradeFacade).toContain("from '../services/self-upgrade-production'")
    expect(upgradeFacade).toContain('createProductionSelfUpgradeInvocation')
    expect(upgradeFacade).not.toContain('createQuantex')
    expect(upgradeFacade).not.toMatch(/from ['"]quantex-core['"]/u)
    expect(upgradeFacade).not.toContain('self/application')
    expect(upgradeFacade).not.toContain('executeCoreSelfUpgrade')

    const productionBridge = await source('src/services/self-upgrade-production.ts')
    expect(productionBridge).toContain("from '../core/self-upgrade-executor'")
    expect(productionBridge).toContain('executeCoreSelfUpgrade')
    expect(productionBridge).toContain('planSelfUpgrade')
    expect(productionBridge).toContain('upgradeSelf')
    expect(productionBridge).not.toContain('createQuantex')
    expect(productionBridge).not.toMatch(/from ['"]quantex-core['"]/u)

    const coreEngine = await source('src/core/self-upgrade-executor.ts')
    expect(coreEngine).toContain('executeCoreSelfUpgrade')
    expect(coreEngine).not.toMatch(/from ['"][^'"]*cli-context['"]/u)
    expect(coreEngine).not.toMatch(/from ['"]\.\.\/self['"]/u)
    expect(coreEngine).not.toMatch(/from ['"]\.\.\/self\//u)
    expect(coreEngine).not.toContain('createQuantex')

    const publicCore = await source('src/core/index.ts')
    expect(publicCore).not.toContain('self-upgrade-executor')
    expect(publicCore).not.toContain('executeCoreSelfUpgrade')

    const packageEntry = await source('packages/core/src/index.ts')
    expect(packageEntry).not.toContain('self-upgrade-executor')
    expect(packageEntry).not.toContain('executeCoreSelfUpgrade')
  })

  it('deletes the leftover self-upgrade application shell', async () => {
    await expect(source('src/self/application.ts')).rejects.toThrow()
    await expect(source('src/core/self-upgrade-production.ts')).rejects.toThrow()

    const barrel = await source('src/services/index.ts')
    expect(barrel).not.toMatch(/from ['"]\.\/self-upgrade-production['"]/u)
  })
})

async function source(path: string): Promise<string> {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
}
