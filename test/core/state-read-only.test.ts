import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createQuantex } from '../../src/core'
import { loadCoreStateDocument } from '../../src/core/production-observation'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

describe('Core state reads', () => {
  it('reads schema version 2 without changing the state tree', async () => {
    const configDir = await createConfigDir()
    const statePath = join(configDir, 'state.json')
    const original = `${JSON.stringify(
      {
        installedAgents: {
          codex: {
            agentName: 'codex',
            installType: 'npm',
            packageName: '@openai/codex',
          },
        },
        lifecycleReceipts: {},
        schemaVersion: 2,
        self: {},
      },
      null,
      2,
    )}\n`
    await writeFile(statePath, original, 'utf8')
    const beforeEntries = await readdir(configDir)

    const document = await loadCoreStateDocument(configDir)

    expect(document.schemaVersion).toBe(2)
    expect(document.installedAgents.codex).toMatchObject({
      agentName: 'codex',
      installType: 'npm',
      packageName: '@openai/codex',
    })
    expect(await readdir(configDir)).toEqual(beforeEntries)
    expect(await readFile(statePath, 'utf8')).toBe(original)
  })

  it('returns an empty schema version 2 projection without creating a missing state file', async () => {
    const configDir = await createConfigDir()

    const document = await loadCoreStateDocument(configDir)

    expect(document).toEqual({
      installedAgents: {},
      lifecycleReceipts: {},
      schemaVersion: 2,
      self: {},
    })
    expect(await readdir(configDir)).toEqual([])
  })

  it('keeps the public catalog list free of config and state writes', async () => {
    const configDir = await createConfigDir()

    const result = await createQuantex({ configDir }).list()

    expect(result.ok).toBe(true)
    expect(result.ok && result.value.length).toBeGreaterThan(0)
    expect(await readdir(configDir)).toEqual([])
  })

  it('fails closed on corrupt state and retains the original bytes', async () => {
    const configDir = await createConfigDir()
    const statePath = join(configDir, 'state.json')
    const corrupt = '{ definitely not valid json\n'
    await writeFile(statePath, corrupt, 'utf8')

    await expect(loadCoreStateDocument(configDir)).rejects.toMatchObject({ name: 'StateSchemaError' })
    expect(await readFile(statePath, 'utf8')).toBe(corrupt)
    expect(await readdir(configDir)).toEqual(['state.json'])
  })

  it('rejects a future state schema instead of treating it as empty', async () => {
    const configDir = await createConfigDir()
    const statePath = join(configDir, 'state.json')
    const future = JSON.stringify({ installedAgents: {}, lifecycleReceipts: {}, schemaVersion: 3, self: {} })
    await writeFile(statePath, future, 'utf8')

    await expect(loadCoreStateDocument(configDir)).rejects.toThrow('unsupported schemaVersion "3"')
    expect(await readFile(statePath, 'utf8')).toBe(future)
  })
})

async function createConfigDir(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'quantex-core-state-'))
  temporaryDirectories.push(directory)
  return directory
}
