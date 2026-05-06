import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as config from '../src/config'
import * as bunPm from '../src/package-manager/bun'
import * as npmPm from '../src/package-manager/npm'
import * as binarySelf from '../src/self/binary'
import * as releaseSelf from '../src/self/release'
import * as version from '../src/utils/version'

const getConfigDirSpy = vi.spyOn(config, 'getConfigDir')
const bunInstallSpy = vi.spyOn(bunPm, 'install')
const bunUpdateSpy = vi.spyOn(bunPm, 'update')
const npmInstallSpy = vi.spyOn(npmPm, 'install')
const npmUpdateSpy = vi.spyOn(npmPm, 'update')
const binaryUpgradeSpy = vi.spyOn(binarySelf, 'upgradeStandaloneBinary')
const releaseManifestSpy = vi.spyOn(releaseSelf, 'fetchBinaryReleaseManifest')
const installedVersionSpy = vi.spyOn(version, 'getInstalledVersion')
const latestVersionSpy = vi.spyOn(version, 'getLatestVersion')
const tempConfigDir = join(tmpdir(), `quantex-self-test-${Date.now()}`)
const originalPlatform = process.platform
const originalArch = process.arch

afterAll(() => {
  getConfigDirSpy.mockRestore()
  bunInstallSpy.mockRestore()
  bunUpdateSpy.mockRestore()
  npmInstallSpy.mockRestore()
  npmUpdateSpy.mockRestore()
  binaryUpgradeSpy.mockRestore()
  releaseManifestSpy.mockRestore()
  installedVersionSpy.mockRestore()
  latestVersionSpy.mockRestore()
  Object.defineProperty(process, 'platform', { value: originalPlatform })
  Object.defineProperty(process, 'arch', { value: originalArch })
})

describe('self helpers', () => {
  beforeEach(() => {
    getConfigDirSpy.mockReturnValue(tempConfigDir)
    bunInstallSpy.mockClear()
    bunUpdateSpy.mockClear()
    npmInstallSpy.mockClear()
    npmUpdateSpy.mockClear()
    binaryUpgradeSpy.mockClear()
    releaseManifestSpy.mockClear()
    installedVersionSpy.mockClear()
    latestVersionSpy.mockClear()
    Object.defineProperty(process, 'platform', { value: originalPlatform })
    Object.defineProperty(process, 'arch', { value: originalArch })
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

  it('prefers a persisted self install source when runtime detection is unknown', async () => {
    const { reconcileSelfInstallSource } = await import('../src/self')
    expect(await reconcileSelfInstallSource('npm', 'unknown')).toBe('npm')
  })

  it('persists a newly detected self install source when state is missing', async () => {
    const { reconcileSelfInstallSource } = await import('../src/self')
    expect(await reconcileSelfInstallSource(undefined, 'binary')).toBe('binary')
  })

  it('treats non-installed package roots as source checkouts', async () => {
    const { detectSelfInstallSource } = await import('../src/self')
    expect(detectSelfInstallSource('/Users/test/workspaces/quantex-cli')).toBe('source')
  })

  it('selects the matching self upgrade provider from the registry', async () => {
    const { getSelfUpgradeProvider, getSelfUpgradeProviderForInstallSource } = await import('../src/self/providers')

    const provider = getSelfUpgradeProvider({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/usr/local/bin/qtx',
      installSource: 'binary',
      packageRoot: '/usr/local/bin',
      updateChannel: 'stable',
    })

    expect(provider.source).toBe('binary')
    expect(getSelfUpgradeProviderForInstallSource('npm', '/usr/local/bin/qtx', 'beta').source).toBe('npm')
  })

  it('upgrades through bun when bun is the detected install source', async () => {
    const { getSelfUpgradeLockPath, upgradeSelf } = await import('../src/self')
    bunInstallSpy.mockResolvedValue(true)
    installedVersionSpy.mockResolvedValue('1.1.0')
    const packageRoot = '/Users/test/.bun/install/global/node_modules/quantex-cli'

    const result = await upgradeSelf({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/Users/test/.bun/bin/quantex',
      installSource: 'bun',
      latestVersion: '1.1.0',
      managedRegistry: 'https://registry.npmjs.org',
      packageRoot,
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    expect(result).toEqual({
      error: undefined,
      installSource: 'bun',
      newVersion: '1.1.0',
      success: true,
    })
    expect(bunInstallSpy).toHaveBeenCalledWith('quantex-cli', 'latest', 'https://registry.npmjs.org')
    expect(bunUpdateSpy).not.toHaveBeenCalled()
    expect(installedVersionSpy).toHaveBeenCalledWith('/Users/test/.bun/bin/quantex', {
      command: [process.execPath, join(packageRoot, 'dist', 'cli.mjs'), '--version'],
    })
    expect(existsSync(getSelfUpgradeLockPath())).toBe(false)
  })

  it('upgrades through npm when npm is the detected install source', async () => {
    const { upgradeSelf } = await import('../src/self')
    npmInstallSpy.mockResolvedValue(true)
    installedVersionSpy.mockResolvedValue('1.1.0')
    const packageRoot = '/usr/local/lib/node_modules/quantex-cli'

    const result = await upgradeSelf({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/usr/local/bin/quantex',
      installSource: 'npm',
      latestVersion: '1.1.0',
      managedRegistry: 'https://registry.npmjs.org',
      packageRoot,
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    expect(result).toEqual({
      error: undefined,
      installSource: 'npm',
      newVersion: '1.1.0',
      success: true,
    })
    expect(npmInstallSpy).toHaveBeenCalledWith('quantex-cli', 'latest', 'https://registry.npmjs.org')
    expect(npmUpdateSpy).not.toHaveBeenCalled()
    expect(installedVersionSpy).toHaveBeenCalledWith('/usr/local/bin/quantex', {
      command: [process.execPath, join(packageRoot, 'dist', 'cli.mjs'), '--version'],
    })
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
    const {
      getBinaryReleaseAssetName,
      getSelfUpdateChannel,
      getSelfUpgradeRecoveryHint,
      parseBinaryReleaseChecksum,
      resolveBinaryReleaseAsset,
      upgradeSelf,
    } = await import('../src/self')
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    Object.defineProperty(process, 'arch', { value: 'arm64' })
    const downloadUrl = 'https://example.com/releases/download/v1.1.0/quantex-darwin-arm64'

    releaseManifestSpy.mockResolvedValue({
      assets: [
        {
          arch: 'arm64',
          checksum: 'abc123',
          downloadUrl,
          name: 'quantex-darwin-arm64',
          platform: 'darwin',
        },
      ],
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
    expect(binaryUpgradeSpy).toHaveBeenCalledWith(downloadUrl, '/usr/local/bin/qtx', 'abc123', '1.1.0')
    expect(
      getSelfUpgradeRecoveryHint('binary', '/usr/local/bin/qtx', 'stable', {
        error: {
          kind: 'network',
          message: 'offline',
        },
        installSource: 'binary',
        success: false,
      }),
    ).toContain('check network access')
    expect(parseBinaryReleaseChecksum(`abc123  quantex-darwin-arm64\n`, 'quantex-darwin-arm64')).toBeUndefined()
    expect(parseBinaryReleaseChecksum(`${'a'.repeat(64)}  quantex-darwin-arm64\n`, 'quantex-darwin-arm64')).toBe(
      'a'.repeat(64),
    )
    expect(getSelfUpdateChannel(undefined, 'stable', { QUANTEX_UPDATE_CHANNEL: 'beta' })).toBe('beta')
    expect(
      resolveBinaryReleaseAsset(
        {
          assets: [
            {
              arch: 'arm64',
              checksum: 'abc123',
              downloadUrl: 'https://example.com/quantex-darwin-arm64',
              name: 'quantex-darwin-arm64',
              platform: 'darwin',
            },
          ],
          channel: 'stable',
          version: '1.1.0',
        },
        '/usr/local/bin/qtx',
      )?.name,
    ).toBe(getBinaryReleaseAssetName('/usr/local/bin/qtx'))
  })

  it('derives manual recovery hints through the provider registry', async () => {
    const { getSelfUpgradeRecoveryHint, getSelfUpgradeRecoveryHintForInspection } = await import('../src/self')

    expect(getSelfUpgradeRecoveryHint('bun', '/Users/test/.bun/bin/qtx', 'beta')).toBe('bun add -g quantex-cli@beta')
    expect(
      getSelfUpgradeRecoveryHintForInspection({
        canAutoUpdate: true,
        currentVersion: '1.0.0',
        executablePath: '/usr/local/bin/qtx',
        installSource: 'npm',
        packageRoot: '/usr/local/lib/node_modules/quantex-cli',
        updateChannel: 'stable',
      }),
    ).toBe('npm install -g quantex-cli@latest')
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
      expect(bunInstallSpy).not.toHaveBeenCalled()
      expect(bunUpdateSpy).not.toHaveBeenCalled()
    } finally {
      await rm(lockPath, { recursive: true, force: true })
    }
  })

  it('resolves package metadata from bundled dist chunks', async () => {
    const { resolveSelfPackageMetadata } = await import('../src/self')
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-self-'))
    const packageRoot = join(tempRoot, 'node_modules', 'quantex-cli')
    const packageJsonPath = join(packageRoot, 'package.json')

    await mkdir(join(packageRoot, 'dist'), { recursive: true })
    await writeFile(
      packageJsonPath,
      JSON.stringify({
        name: 'quantex-cli',
        version: '1.2.3',
      }),
    )

    try {
      const metadata = await resolveSelfPackageMetadata(
        pathToFileURL(join(packageRoot, 'dist', 'self-abc123.mjs')).href,
      )

      expect(metadata).toEqual({
        foundPackageJson: true,
        packageJsonPath,
        packageRoot,
        version: '1.2.3',
      })
    } finally {
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

  it('prefers QTX self-update registry overrides over package-manager defaults', async () => {
    const { resolveManagedSelfUpdateRegistry } = await import('../src/self')

    await expect(
      resolveManagedSelfUpdateRegistry(
        'npm',
        {
          defaultPackageManager: 'bun',
          networkRetries: 2,
          networkTimeoutMs: 10000,
          npmBunUpdateStrategy: 'latest-major',
          selfUpdateChannel: 'stable',
          versionCacheTtlHours: 6,
        },
        {
          QTX_SELF_UPDATE_REGISTRY: 'https://registry.npmjs.org/',
          npm_config_registry: 'https://registry.npmmirror.com',
        },
      ),
    ).resolves.toEqual({
      isOverride: true,
      registry: 'https://registry.npmjs.org',
      source: 'quantex-env',
    })
  })

  it('reads managed self-upgrade registries from npmrc files', async () => {
    const { resolveManagedSelfUpdateRegistry } = await import('../src/self')
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-self-registry-'))
    const projectDir = join(tempRoot, 'project')
    const homeDir = join(tempRoot, 'home')

    await mkdir(projectDir, { recursive: true })
    await mkdir(homeDir, { recursive: true })
    await writeFile(join(projectDir, '.npmrc'), 'registry=https://registry.npmmirror.com/\n')

    try {
      await expect(
        resolveManagedSelfUpdateRegistry(
          'bun',
          {
            defaultPackageManager: 'bun',
            networkRetries: 2,
            networkTimeoutMs: 10000,
            npmBunUpdateStrategy: 'latest-major',
            selfUpdateChannel: 'stable',
            versionCacheTtlHours: 6,
          },
          {
            HOME: homeDir,
          },
          projectDir,
        ),
      ).resolves.toEqual({
        isOverride: false,
        registry: 'https://registry.npmmirror.com',
        source: 'npmrc',
      })
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('fails managed self-upgrade verification when the installed version does not change', async () => {
    const { upgradeSelf } = await import('../src/self')
    npmInstallSpy.mockResolvedValue(true)
    installedVersionSpy.mockResolvedValue('1.0.0')

    const result = await upgradeSelf({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/usr/local/bin/quantex',
      installSource: 'npm',
      latestVersion: '1.1.0',
      managedRegistry: 'https://registry.npmjs.org',
      packageRoot: '/usr/local/lib/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    expect(result).toEqual({
      error: {
        detail: {
          expectedVersion: '1.1.0',
          observedVersion: '1.0.0',
        },
        kind: 'verify',
        message: 'Managed self-upgrade installed version 1.0.0, but expected 1.1.0.',
      },
      installSource: 'npm',
      success: false,
    })
  })

  it('does not fail managed verification when latestVersion was unresolved and install succeeds without a semver bump', async () => {
    const { upgradeSelf } = await import('../src/self')
    npmInstallSpy.mockResolvedValue(true)
    installedVersionSpy.mockResolvedValue('1.0.0')

    const result = await upgradeSelf({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/usr/local/bin/quantex',
      installSource: 'npm',
      managedRegistry: 'https://registry.npmjs.org',
      packageRoot: '/usr/local/lib/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    expect(result).toEqual({
      error: undefined,
      installSource: 'npm',
      newVersion: '1.0.0',
      success: true,
    })
  })

  it('verifies managed self-upgrade against the installed cli entrypoint under node runtime', async () => {
    const { upgradeSelf } = await import('../src/self')
    npmInstallSpy.mockResolvedValue(true)
    const packageRoot = '/usr/local/lib/node_modules/quantex-cli'
    const expectedCommand = [process.execPath, join(packageRoot, 'dist', 'cli.mjs'), '--version']

    installedVersionSpy.mockImplementation(async (_binaryName, versionProbe) => {
      return JSON.stringify(versionProbe?.command) === JSON.stringify(expectedCommand) ? '1.1.0' : '22.22.2'
    })

    const result = await upgradeSelf({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: process.execPath,
      installSource: 'npm',
      latestVersion: '1.1.0',
      managedRegistry: 'https://registry.npmjs.org',
      packageRoot,
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    expect(result).toEqual({
      error: undefined,
      installSource: 'npm',
      newVersion: '1.1.0',
      success: true,
    })
    expect(installedVersionSpy).toHaveBeenCalledTimes(1)
    expect(installedVersionSpy).toHaveBeenCalledWith(process.execPath, {
      command: expectedCommand,
    })
  })

  it('falls back to the executable-path probe when the managed entrypoint probe fails', async () => {
    const { upgradeSelf } = await import('../src/self')
    npmInstallSpy.mockResolvedValue(true)
    installedVersionSpy.mockResolvedValueOnce(undefined).mockResolvedValueOnce('1.1.0')
    const packageRoot = '/usr/local/lib/node_modules/quantex-cli'

    const result = await upgradeSelf({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/usr/local/bin/quantex',
      installSource: 'npm',
      latestVersion: '1.1.0',
      managedRegistry: 'https://registry.npmjs.org',
      packageRoot,
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    expect(result).toEqual({
      error: undefined,
      installSource: 'npm',
      newVersion: '1.1.0',
      success: true,
    })
    expect(installedVersionSpy).toHaveBeenNthCalledWith(1, '/usr/local/bin/quantex', {
      command: [process.execPath, join(packageRoot, 'dist', 'cli.mjs'), '--version'],
    })
    expect(installedVersionSpy).toHaveBeenNthCalledWith(2, '/usr/local/bin/quantex')
  })
})
