import type { QuantexState } from '../../src/state'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../../src/cli-context'
import { executeCommandWithRuntime } from '../../src/command-runtime'
import { commandsCommand } from '../../src/commands/commands'
import { cliErrorCodes, getExitCodeForResult } from '../../src/errors'
import { loadState, StateFileError } from '../../src/state'

interface CompatibilitySurface {
  binaryNames: string[]
  commands: string[]
  errorCodes: string[]
  packageName: string
  schemaVersion: string
}

interface PackageManifest {
  bin: Record<string, string>
  name: string
}

let tempHome = ''

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), 'quantex-v1-compatibility-'))
  vi.stubEnv('HOME', tempHome)
  await mkdir(join(tempHome, '.quantex'), { recursive: true })
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(tempHome, { force: true, recursive: true })
})

describe('v1 compatibility baseline', () => {
  it('locks the package, binary, command, schema-version, and error-code surface', async () => {
    const surface = await readFixture<CompatibilitySurface>('surface.json')
    const packageJson = await readPackageManifest()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      setCliContext({
        interactive: false,
        outputMode: 'human',
        runId: 'v1-compatibility-surface',
      })

      const result = await commandsCommand()

      expect(packageJson.name).toBe(surface.packageName)
      expect(Object.keys(packageJson.bin).sort()).toEqual(surface.binaryNames)
      expect(cliErrorCodes).toEqual(surface.errorCodes)
      expect(result.meta.schemaVersion).toBe(surface.schemaVersion)
      expect(result.data?.commands.map(command => command.name)).toEqual(surface.commands)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('locks the maintained root-package runtime exports', async () => {
    const rootExports = await readFixture<string[]>('root-exports.json')

    expect(Object.keys(await import('../../src/index')).sort()).toEqual(rootExports)
  })

  it('loads valid and ghost v1 state without changing its meaning', async () => {
    const validFixture = await installStateFixture('valid.json')
    expect(await loadState()).toEqual(validFixture)

    const ghostFixture = await installStateFixture('ghost.json')
    const ghostState = await loadState()

    expect(ghostState).toEqual(ghostFixture)
    expect(ghostState.installedAgents.codex).toBeDefined()
  })

  it('represents an untracked agent by its absence from v1 state', async () => {
    const untrackedFixture = await installStateFixture('untracked.json')
    const state = await loadState()

    expect(state).toEqual(untrackedFixture)
    expect(state.installedAgents.codex).toBeUndefined()
  })

  it('keeps corrupt v1 state fail-closed with STATE_READ_ERROR behavior', async () => {
    await installStateFixtureText('corrupt.txt')

    await expect(loadState()).rejects.toBeInstanceOf(StateFileError)

    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'v1-compatibility-corrupt-state',
    })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const result = await executeCommandWithRuntime({
        action: 'compatibility-state',
        run: async () => {
          await loadState()
          throw new Error('Expected corrupt state to fail before this point.')
        },
        target: {
          kind: 'system',
          name: 'state',
        },
      })

      expect(result.error?.code).toBe('STATE_READ_ERROR')
      expect(getExitCodeForResult(result)).toBe(12)
    } finally {
      logSpy.mockRestore()
    }
  })
})

async function readFixture<T>(fixturePath: string): Promise<T> {
  return JSON.parse(await readFixtureText(fixturePath)) as T
}

async function readFixtureText(fixturePath: string): Promise<string> {
  return readFile(new URL(`../fixtures/compatibility/v1/${fixturePath}`, import.meta.url), 'utf8')
}

async function readPackageManifest(): Promise<PackageManifest> {
  return JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as PackageManifest
}

async function installStateFixture(fixtureName: string): Promise<QuantexState> {
  const fixture = await readFixture<QuantexState>(`state/${fixtureName}`)
  await writeFile(join(tempHome, '.quantex', 'state.json'), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8')
  return fixture
}

async function installStateFixtureText(fixtureName: string): Promise<void> {
  await writeFile(join(tempHome, '.quantex', 'state.json'), await readFixtureText(`state/${fixtureName}`), 'utf8')
}
