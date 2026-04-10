import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as bunPm from '../src/package-manager/bun'
import * as npmPm from '../src/package-manager/npm'
import * as version from '../src/utils/version'

const bunUpdateSpy = vi.spyOn(bunPm, 'update')
const npmUpdateSpy = vi.spyOn(npmPm, 'update')
const latestVersionSpy = vi.spyOn(version, 'getLatestVersion')

afterAll(() => {
  bunUpdateSpy.mockRestore()
  npmUpdateSpy.mockRestore()
  latestVersionSpy.mockRestore()
})

describe('self helpers', () => {
  beforeEach(() => {
    bunUpdateSpy.mockClear()
    npmUpdateSpy.mockClear()
    latestVersionSpy.mockClear()
  })

  it('detects bun global installations from the package root path', async () => {
    const { detectSelfInstallSource } = await import('../src/self')
    expect(detectSelfInstallSource('/Users/test/.bun/install/global/node_modules/quantex-cli')).toBe('bun')
  })

  it('detects npm global installations from the package root path', async () => {
    const { detectSelfInstallSource } = await import('../src/self')
    expect(detectSelfInstallSource('/usr/local/lib/node_modules/quantex-cli')).toBe('npm')
  })

  it('treats non-installed package roots as source checkouts', async () => {
    const { detectSelfInstallSource } = await import('../src/self')
    expect(detectSelfInstallSource('/Users/test/workspaces/quantex-cli')).toBe('source')
  })

  it('upgrades through bun when bun is the detected install source', async () => {
    const { upgradeSelf } = await import('../src/self')
    bunUpdateSpy.mockResolvedValue(true)

    const result = await upgradeSelf({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      installSource: 'bun',
      latestVersion: '1.1.0',
      packageRoot: '/Users/test/.bun/install/global/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
    })

    expect(result).toEqual({
      installSource: 'bun',
      success: true,
    })
    expect(bunUpdateSpy).toHaveBeenCalledWith('quantex-cli')
  })

  it('upgrades through npm when npm is the detected install source', async () => {
    const { upgradeSelf } = await import('../src/self')
    npmUpdateSpy.mockResolvedValue(true)

    const result = await upgradeSelf({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      installSource: 'npm',
      latestVersion: '1.1.0',
      packageRoot: '/usr/local/lib/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
    })

    expect(result).toEqual({
      installSource: 'npm',
      success: true,
    })
    expect(npmUpdateSpy).toHaveBeenCalledWith('quantex-cli')
  })

  it('reports source installs as unsupported for auto-update', async () => {
    const { upgradeSelf } = await import('../src/self')

    const result = await upgradeSelf({
      canAutoUpdate: false,
      currentVersion: '1.0.0',
      installSource: 'source',
      latestVersion: '1.1.0',
      packageRoot: '/Users/test/workspaces/quantex-cli',
    })

    expect(result).toEqual({
      installSource: 'source',
      success: false,
    })
  })

  it('inspects the current CLI and resolves latest version metadata', async () => {
    const { inspectSelf } = await import('../src/self')
    latestVersionSpy.mockResolvedValue('9.9.9')

    const inspection = await inspectSelf()

    expect(inspection.currentVersion).toBeTruthy()
    expect(inspection.installSource).toBe('source')
    expect(inspection.canAutoUpdate).toBe(false)
    expect(inspection.latestVersion).toBe('9.9.9')
  })
})
