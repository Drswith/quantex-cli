import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSpawn = vi.fn()
let originalSpawn: typeof Bun.spawn

function createProc(exitCode: number, stdout = '', stderr = '') {
  return {
    exited: Promise.resolve(exitCode),
    exitCode,
    stdout,
    stderr,
  }
}

beforeEach(() => {
  originalSpawn = Bun.spawn
  Bun.spawn = mockSpawn as any
})

afterEach(() => {
  Bun.spawn = originalSpawn
  mockSpawn.mockClear()
})

describe('brew probePackagePresence', () => {
  it('returns present when brew list reports an installed formula version', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue(createProc(0, 'crush 0.6.0\n'))

    expect(await probePackagePresence('crush')).toBe('present')
    expect(mockSpawn).toHaveBeenCalledWith(
      ['brew', 'list', '--formula', '--versions', 'crush'],
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }),
    )
  })

  it('returns present for installed casks', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue(createProc(0, 'droid 1.2.3\n'))

    expect(await probePackagePresence('droid', 'cask')).toBe('present')
    expect(mockSpawn).toHaveBeenCalledWith(
      ['brew', 'list', '--cask', '--versions', 'droid'],
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }),
    )
  })

  it('returns absent when brew reports the package is missing', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue(createProc(1, '', 'Error: No such keg: /opt/homebrew/Cellar/crush\n'))

    expect(await probePackagePresence('crush')).toBe('absent')
  })

  it('returns unknown when brew list fails without a missing-package signal', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue(createProc(1, '', 'Error: Another brew failure\n'))

    expect(await probePackagePresence('crush')).toBe('unknown')
  })

  it('returns unknown when brew list succeeds without a parseable version', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue(createProc(0, 'crush\n'))

    expect(await probePackagePresence('crush')).toBe('present')
  })
})

describe('parseBrewInstalledVersion', () => {
  it('extracts a version from brew list --versions output', async () => {
    const { parseBrewInstalledVersion } = await import('../../src/package-manager/brew')

    expect(parseBrewInstalledVersion('crush 0.6.0\n')).toBe('0.6.0')
    expect(parseBrewInstalledVersion('jetbrains-junie/junie/junie 1.0.0\n')).toBe('1.0.0')
  })

  it('returns undefined for empty or unparseable output', async () => {
    const { parseBrewInstalledVersion } = await import('../../src/package-manager/brew')

    expect(parseBrewInstalledVersion('')).toBeUndefined()
    expect(parseBrewInstalledVersion('crush\n')).toBeUndefined()
  })
})

describe('brew getInstalledVersion', () => {
  it('returns the installed version when brew list succeeds', async () => {
    const { getInstalledVersion } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue(createProc(0, 'codex 0.26.0\n'))

    expect(await getInstalledVersion('codex')).toBe('0.26.0')
  })
})
