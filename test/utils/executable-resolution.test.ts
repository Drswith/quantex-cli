import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getExecutableCandidateNames, getKnownAgentInstallDirectories } from '../../src/utils/executable-search-paths'

const mockSpawn = vi.hoisted(() => vi.fn())
let originalSpawn: typeof Bun.spawn

vi.mock('cross-spawn', async () => {
  const { createCrossSpawnMock } = await import('../helpers/cross-spawn-mock')
  return { default: createCrossSpawnMock(mockSpawn) }
})

beforeEach(() => {
  originalSpawn = Bun.spawn
  Bun.spawn = mockSpawn as any
})

afterEach(() => {
  Bun.spawn = originalSpawn
  mockSpawn.mockClear()
  vi.unstubAllEnvs()
})

function createMockProcess(exitCode: number, stdout = '') {
  return {
    exited: Promise.resolve(),
    exitCode,
    stdout: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stdout))
        controller.close()
      },
    }),
    stderr: new ReadableStream({
      start(controller) {
        controller.close()
      },
    }),
  }
}

const posixInputs = {
  env: {} as NodeJS.ProcessEnv,
  homeDir: '/home/agent',
  platform: 'linux' as NodeJS.Platform,
}

describe('getKnownAgentInstallDirectories', () => {
  // `join` uses the host separator, so expectations are built the same way rather
  // than hardcoding POSIX strings that would fail on a Windows runner.
  it('derives every POSIX directory from the supplied home', () => {
    expect(getKnownAgentInstallDirectories(posixInputs)).toEqual([
      join('/home/agent', '.local', 'bin'),
      join('/home/agent', 'bin'),
      join('/home/agent', '.bun', 'bin'),
      join('/home/agent', '.cargo', 'bin'),
      join('/home/agent', '.deno', 'bin'),
      join('/home/agent', '.npm-global', 'bin'),
    ])
  })

  it('honors the toolchain root environment overrides', () => {
    const directories = getKnownAgentInstallDirectories({
      ...posixInputs,
      env: { BUN_INSTALL: '/opt/bun', CARGO_HOME: '/opt/cargo', DENO_INSTALL_ROOT: '/opt/deno' },
    })

    expect(directories).toContain(join('/opt/bun', 'bin'))
    expect(directories).toContain(join('/opt/cargo', 'bin'))
    expect(directories).toContain(join('/opt/deno', 'bin'))
    expect(directories).not.toContain(join('/home/agent', '.bun', 'bin'))
  })

  it('emits no duplicate directory when overrides collide with defaults', () => {
    const directories = getKnownAgentInstallDirectories({
      ...posixInputs,
      env: { BUN_INSTALL: '/home/agent/.bun' },
    })

    expect(directories).toEqual([...new Set(directories)])
  })
})

describe('getExecutableCandidateNames', () => {
  it('uses the bare name on POSIX', () => {
    expect(getExecutableCandidateNames('agy', posixInputs)).toEqual(['agy'])
  })

  it('appends configured Windows executable extensions', () => {
    const names = getExecutableCandidateNames('agy', {
      env: { PATHEXT: '.COM;.EXE;.CMD' },
      homeDir: 'C:\\Users\\agent',
      platform: 'win32',
    })

    expect(names).toEqual(['agy', 'agy.com', 'agy.exe', 'agy.cmd'])
  })
})

describe('resolveAgentExecutablePath', () => {
  it('prefers the inherited PATH and does not consult known directories', async () => {
    const { resolveAgentExecutablePath } = await import('../../src/utils/executable-resolution')
    mockSpawn.mockReturnValue(createMockProcess(0, '/usr/local/bin/agy\n/home/agent/.local/bin/agy\n'))

    expect(await resolveAgentExecutablePath('agy')).toBe('/usr/local/bin/agy')
  })

  it('falls back to a known install directory when PATH does not resolve', async () => {
    if (process.platform === 'win32') return

    const home = await mkdtemp(join(tmpdir(), 'qtx-resolution-'))
    const binDirectory = join(home, '.local', 'bin')
    await mkdir(binDirectory, { recursive: true })
    const executable = join(binDirectory, 'agy')
    await writeFile(executable, '#!/bin/sh\n')
    await chmod(executable, 0o755)

    vi.stubEnv('HOME', home)
    const { resolveAgentExecutablePath } = await import('../../src/utils/executable-resolution')
    mockSpawn.mockReturnValue(createMockProcess(1, ''))

    expect(await resolveAgentExecutablePath('agy')).toBe(executable)
  })

  it('reports absent when neither PATH nor a known directory resolves', async () => {
    const home = await mkdtemp(join(tmpdir(), 'qtx-resolution-'))
    vi.stubEnv('HOME', home)
    const { resolveAgentExecutablePath } = await import('../../src/utils/executable-resolution')
    mockSpawn.mockReturnValue(createMockProcess(1, ''))

    expect(await resolveAgentExecutablePath('definitely-missing-agent')).toBeUndefined()
  })

  it('does not treat a non-executable file as a resolved agent', async () => {
    if (process.platform === 'win32') return

    const home = await mkdtemp(join(tmpdir(), 'qtx-resolution-'))
    const binDirectory = join(home, '.local', 'bin')
    await mkdir(binDirectory, { recursive: true })
    await writeFile(join(binDirectory, 'agy'), 'not executable')
    await chmod(join(binDirectory, 'agy'), 0o644)

    vi.stubEnv('HOME', home)
    const { resolveAgentExecutablePath } = await import('../../src/utils/executable-resolution')
    mockSpawn.mockReturnValue(createMockProcess(1, ''))

    expect(await resolveAgentExecutablePath('agy')).toBeUndefined()
  })
})
