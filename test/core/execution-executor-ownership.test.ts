import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('CLI Core execution ownership', () => {
  it('routes exec and shortcut launch through in-repo Core without a public SDK run()', async () => {
    const runFacade = await source('src/commands/run.ts')
    expect(runFacade).toContain("from '../core/execution-executor'")
    expect(runFacade).toContain("from '../services/lifecycle-execution-production'")
    expect(runFacade).not.toContain('createQuantex')
    expect(runFacade).not.toMatch(/from ['"]quantex-core['"]/u)

    const productionBridge = await source('src/services/lifecycle-execution-production.ts')
    expect(productionBridge).toContain("from '../core/execution-executor'")
    expect(productionBridge).toContain('executeAgentLifecycle')
    expect(productionBridge).toContain("stdio: options.outputMode === 'human'")
    expect(productionBridge).not.toContain('createQuantex')
    expect(productionBridge).not.toMatch(/from ['"]quantex-core['"]/u)

    await expect(source('src/services/lifecycle-execution.ts')).rejects.toThrow()

    const coreEngine = await source('src/core/execution-executor.ts')
    expect(coreEngine).toContain('executeAgentLifecycle')
    expect(coreEngine).toContain('ports.stdio')
    expect(coreEngine).not.toContain('cli-context')
    expect(coreEngine).not.toContain('createQuantex')

    const publicCore = await source('src/core/index.ts')
    expect(publicCore).not.toContain('execution-executor')
    expect(publicCore).not.toContain('executeAgentLifecycle')

    const packageEntry = await source('packages/core/src/index.ts')
    expect(packageEntry).not.toContain('execution-executor')
    expect(packageEntry).not.toContain('executeAgentLifecycle')

    const shortcut = await source('src/commands/shortcut.ts')
    expect(shortcut).toContain('resolveShortcutInvocation')
    expect(shortcut).not.toContain('createQuantex')

    const cli = await source('src/cli.ts')
    expect(cli).toContain('runCommand')
    expect(cli).toContain('resolveShortcutInvocation')
  })
})

async function source(path: string): Promise<string> {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
}
