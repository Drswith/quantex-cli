import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as config from '../src/config'
import * as bunPm from '../src/package-manager/bun'
import * as npmPm from '../src/package-manager/npm'
import * as binarySelf from '../src/self/binary'
import * as releaseSelf from '../src/self/release'
import * as version from '../src/utils/version'

const getConfigDirSpy = vi.spyOn(config, 'getConfigDir')
const bunUpdateSpy = vi.spyOn(bunPm, 'update')
const npmUpdateSpy = vi.spyOn(npmPm, 'update')
const binaryUpgradeSpy = vi.spyOn(binarySelf, 'upgradeStandaloneBinary')
const releaseManifestSpy = vi.spyOn(releaseSelf, 'fetchBinaryReleaseManifest')
const latestVersionSpy = vi.spyOn(version, 'getLatestVersion')
const tempConfigDir = join(tmpdir(), `quantex-self-test-${Date.now()}`)

afterAll(() => {
  getConfigDirSpy.mockRestore()
  bunUpdateSpy.mockRestore()
  npmUpdateSpy.mockRestore()
  binaryUpgradeSpy.mockRestore()
  releaseManifestSpy.mockRestore()
  latestVersionSpy.mockRestore()
})

describe('self helpers', () => {
  beforeEach(() => {
    getConfigDirSpy.mockReturnValue(tempConfigDir)
    bunUpdateSpy.mockClear()
    npmUpdateSpy.mockClear()
    binaryUpgradeSpy.mockClear()
    releaseManifestSpy.mockClear()
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

  it('detects standalone binaries from the executable path', async () => {
    const { detectSelfInstallSource } = await import('../src/self')
    expect(detectSelfInstallSource('', '/usr/local/bin/qtx')).toBe('binary')
  })

  it('treats non-installed package roots as source checkouts', async () => {
    const { detectSelfInstallSource } = await import('../src/self')
    expect(detectSelfInstallSource('/Users/test/workspaces/quantex-cli')).toBe('source')
  })

  it('selects the matching self upgrade provider from the registry', async () => {
    const { getSelfUpgradeProvider } = await import('../src/self/providers')

    const provider = getSelfUpgradeProvider({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/usr/local/bin/qtx',
      installSource: 'binary',
      packageRoot: '/usr/local/bin',
      updateChannel: 'stable',
    })

    expect(provider.source).toBe('binary')
  })

  it('upgrades through bun when bun is the detected install source', async () => {
    const { getSelfUpgradeLockPath, upgradeSelf } = await import('../src/self')
    bunUpdateSpy.mockResolvedValue(true)

    const result = await upgradeSelf({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/Users/test/.bun/bin/quantex',
      installSource: 'bun',
      latestVersion: '1.1.0',
      packageRoot: '/Users/test/.bun/install/global/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    expect(result).toEqual({
      error: undefined,
      installSource: 'bun',
      newVersion: '1.1.0',
      success: true,
    })
    expect(bunUpdateSpy).toHaveBeenCalledWith('quantex-cli', 'latest-major', 'latest')
    expect(existsSync(getSelfUpgradeLockPath())).toBe(false)
  })

  it('upgrades through npm when npm is the detected install source', async () => {
    const { upgradeSelf } = await import('../src/self')
    npmUpdateSpy.mockResolvedValue(true)

    const result = await upgradeSelf({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/usr/local/bin/quantex',
      installSource: 'npm',
      latestVersion: '1.1.0',
      packageRoot: '/usr/local/lib/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    expect(result).toEqual({
      error: undefined,
      installSource: 'npm',
      newVersion: '1.1.0',
      success: true,
    })
    expect(npmUpdateSpy).toHaveBeenCalledWith('quantex-cli', 'latest-major', 'latest')
  })

  it('reports source installs as unsupported for auto-update', async () => {
    const { getSelfUpgradeLockPath, upgradeSelf } = await import('../src/self')

    const result = await upgradeSelf({
      canAutoUpdate: false,
      currentVersion: '1.0.0',
      executablePath: '/Users/test/workspaces/quantex-cli/node_modules/.bin/bun',
      installSource: 'source',
      latestVersion: '1.1.0',
      packageRoot: '/Users/test/workspaces/quantex-cli',
      updateChannel: 'stable',
    })

    expect(result).toEqual({
      error: {
        kind: 'unsupported',
        message: 'Install source "source" does not support auto-update.',
      },
      installSource: 'source',
      success: false,
    })
    expect(existsSync(getSelfUpgradeLockPath())).toBe(false)
  })

  it('upgrades standalone binaries through release downloads', async () => {
    const { getSelfUpdateChannel, getSelfUpgradeRecoveryHint, parseBinaryReleaseChecksum, resolveBinaryReleaseAsset, upgradeSelf } = await import('../src/self')
    releaseManifestSpy.mockResolvedValue({
      assets: [{
        arch: 'arm64',
        checksum: 'abc123',
        downloadUrl: 'https://example.com/releases/download/v1.1.0/quantex-darwin-arm64',
        name: 'quantex-darwin-arm64',
        platform: 'darwin',
      }],
      channel: 'stable',
      version: '1.1.0',
    })
    binaryUpgradeSpy.mockResolvedValue({ success: true })

    const result = await upgradeSelf({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/usr/local/bin/qtx',
      installSource: 'binary',
      latestVersion: '1.1.0',
      packageRoot: '/usr/local/bin',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    expect(result).toEqual({
      success: true,
      installSource: 'binary',
      newVersion: '1.1.0',
    })
    expect(binaryUpgradeSpy).toHaveBeenCalledWith(
      'https://example.com/releases/download/v1.1.0/quantex-darwin-arm64',
      '/usr/local/bin/qtx',
      'abc123',
      '1.1.0',
    )
    expect(getSelfUpgradeRecoveryHint('binary', '/usr/local/bin/qtx', 'stable', {
      error: {
        kind: 'network',
        message: 'offline',
      },
      installSource: 'binary',
      success: false,
    })).toContain('check network access')
    expect(parseBinaryReleaseChecksum(`abc123  quantex-darwin-arm64\n`, 'quantex-darwin-arm64')).toBeUndefined()
    expect(parseBinaryReleaseChecksum(`${'a'.repeat(64)}  quantex-darwin-arm64\n`, 'quantex-darwin-arm64')).toBe('a'.repeat(64))
    expect(getSelfUpdateChannel(undefined, 'stable', { QUANTEX_UPDATE_CHANNEL: 'beta' })).toBe('beta')
    expect(resolveBinaryReleaseAsset({
      assets: [{
        arch: 'arm64',
        checksum: 'abc123',
        downloadUrl: 'https://example.com/quantex-darwin-arm64',
        name: 'quantex-darwin-arm64',
        platform: 'darwin',
      }],
      channel: 'stable',
      version: '1.1.0',
    }, '/usr/local/bin/qtx')?.downloadUrl).toBe('https://example.com/quantex-darwin-arm64')
  })

  it('returns a locked error when another self upgrade is already running', async () => {
    const { getSelfUpgradeLockPath, upgradeSelf } = await import('../src/self')
    const lockPath = getSelfUpgradeLockPath()

    await mkdir(lockPath, { recursive: true })

    try {
      const result = await upgradeSelf({
        canAutoUpdate: true,
        currentVersion: '1.0.0',
        executablePath: '/Users/test/.bun/bin/quantex',
        installSource: 'bun',
        latestVersion: '1.1.0',
        packageRoot: '/Users/test/.bun/install/global/node_modules/quantex-cli',
        recommendedUpgradeCommand: 'quantex upgrade',
        updateChannel: 'stable',
      })

      expect(result).toEqual({
        error: {
          kind: 'locked',
          message: 'Another qtx upgrade is already running.',
        },
        installSource: 'bun',
        success: false,
      })
      expect(bunUpdateSpy).not.toHaveBeenCalled()
    }
    finally {
      await rm(lockPath, { recursive: true, force: true })
    }
  })

  it('resolves package metadata from bundled dist chunks', async () => {
    const { resolveSelfPackageMetadata } = await import('../src/self')
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-self-'))
    const packageRoot = join(tempRoot, 'node_modules', 'quantex-cli')
    const packageJsonPath = join(packageRoot, 'package.json')

    await mkdir(join(packageRoot, 'dist'), { recursive: true })
    await writeFile(packageJsonPath, JSON.stringify({
      name: 'quantex-cli',
      version: '1.2.3',
    }))

    try {
      const metadata = await resolveSelfPackageMetadata(pathToFileURL(join(packageRoot, 'dist', 'self-abc123.mjs')).href)

      expect(metadata).toEqual({
        foundPackageJson: true,
        packageJsonPath,
        packageRoot,
        version: '1.2.3',
      })
    }
    finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('inspects the current CLI and resolves latest version metadata', async () => {
    const { inspectSelf } = await import('../src/self')
    latestVersionSpy.mockResolvedValue('9.9.9')

    const inspection = await inspectSelf()

    expect(inspection.currentVersion).toBeTruthy()
    expect(inspection.installSource).toBe('source')
    expect(inspection.canAutoUpdate).toBe(false)
    expect(inspection.executablePath).toBeTruthy()
    expect(inspection.latestVersion).toBe('9.9.9')
    expect(inspection.updateChannel).toBe('stable')
  })
})
