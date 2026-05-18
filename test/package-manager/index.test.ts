import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as config from '../../src/config'
import * as binaryPm from '../../src/package-manager/binary'
import * as bunPm from '../../src/package-manager/bun'
import * as cargoPm from '../../src/package-manager/cargo'
import {
  installAgent,
  trackInstalledAgent,
  uninstallAgent,
  updateAgent,
  updateAgentsByType,
} from '../../src/package-manager/index'
import * as npmPm from '../../src/package-manager/npm'
import * as state from '../../src/state'
import * as detectUtils from '../../src/utils/detect'

const bunInstallSpy = vi.spyOn(bunPm, 'install')
const bunUpdateSpy = vi.spyOn(bunPm, 'update')
const bunUpdateManySpy = vi.spyOn(bunPm, 'updateMany')
const bunUninstallSpy = vi.spyOn(bunPm, 'uninstall')
const cargoInstallSpy = vi.spyOn(cargoPm, 'install')
const cargoUpdateSpy = vi.spyOn(cargoPm, 'update')
const cargoUpdateManySpy = vi.spyOn(cargoPm, 'updateMany')
const cargoUninstallSpy = vi.spyOn(cargoPm, 'uninstall')
const npmInstallSpy = vi.spyOn(npmPm, 'install')
const npmUpdateSpy = vi.spyOn(npmPm, 'update')
const npmUpdateManySpy = vi.spyOn(npmPm, 'updateMany')
const npmUninstallSpy = vi.spyOn(npmPm, 'uninstall')
const binarySpy = vi.spyOn(binaryPm, 'runBinaryInstall')
const loadConfigSpy = vi.spyOn(config, 'loadConfig')
const getPlatformSpy = vi.spyOn(detectUtils, 'getPlatform')
const isBunSpy = vi.spyOn(detectUtils, 'isBunAvailable')
const isCargoSpy = vi.spyOn(detectUtils, 'isCargoAvailable')
const isNpmSpy = vi.spyOn(detectUtils, 'isNpmAvailable')
const getInstalledAgentStateSpy = vi.spyOn(state, 'getInstalledAgentState')
const setInstalledAgentStateSpy = vi.spyOn(state, 'setInstalledAgentState')
const removeInstalledAgentStateSpy = vi.spyOn(state, 'removeInstalledAgentState')
const getConfigDirSpy = vi.spyOn(config, 'getConfigDir')
const tempDir = join(tmpdir(), `quantex-package-manager-test-${Date.now()}`)

const testAgent = {
  name: 'test-agent',
  lookupAliases: [] as string[],
  displayName: 'Test Agent',
  homepage: 'https://example.com',
  packages: { npm: 'test-pkg' },
  binaryName: 'test-bin',
  platforms: {
    linux: [{ type: 'bun' as const }, { type: 'npm' as const }],
  },
}

beforeEach(() => {
  bunInstallSpy.mockClear()
  bunUpdateSpy.mockClear()
  bunUpdateManySpy.mockClear()
  bunUninstallSpy.mockClear()
  cargoInstallSpy.mockClear()
  cargoUpdateSpy.mockClear()
  cargoUpdateManySpy.mockClear()
  cargoUninstallSpy.mockClear()
  npmInstallSpy.mockClear()
  npmUpdateSpy.mockClear()
  npmUpdateManySpy.mockClear()
  npmUninstallSpy.mockClear()
  binarySpy.mockClear()
  loadConfigSpy.mockClear()
  getPlatformSpy.mockClear()
  isBunSpy.mockClear()
  isCargoSpy.mockClear()
  isNpmSpy.mockClear()
  getInstalledAgentStateSpy.mockClear()
  setInstalledAgentStateSpy.mockClear()
  removeInstalledAgentStateSpy.mockClear()
  getPlatformSpy.mockReturnValue('linux')
  getConfigDirSpy.mockReturnValue(tempDir)
  loadConfigSpy.mockResolvedValue({
    defaultPackageManager: 'bun',
    networkRetries: 2,
    networkTimeoutMs: 10000,
    npmBunUpdateStrategy: 'latest-major',
    selfUpdateChannel: 'stable',
    versionCacheTtlHours: 6,
  })
  getInstalledAgentStateSpy.mockResolvedValue(undefined)
  removeInstalledAgentStateSpy.mockResolvedValue()
})

beforeEach(() => {
  if (existsSync(tempDir)) rmSync(tempDir, { force: true, recursive: true })
})

afterAll(() => {
  bunInstallSpy.mockRestore()
  bunUpdateSpy.mockRestore()
  bunUpdateManySpy.mockRestore()
  bunUninstallSpy.mockRestore()
  cargoInstallSpy.mockRestore()
  cargoUpdateSpy.mockRestore()
  cargoUpdateManySpy.mockRestore()
  cargoUninstallSpy.mockRestore()
  npmInstallSpy.mockRestore()
  npmUpdateSpy.mockRestore()
  npmUpdateManySpy.mockRestore()
  npmUninstallSpy.mockRestore()
  binarySpy.mockRestore()
  loadConfigSpy.mockRestore()
  getPlatformSpy.mockRestore()
  isBunSpy.mockRestore()
  isCargoSpy.mockRestore()
  isNpmSpy.mockRestore()
  getInstalledAgentStateSpy.mockRestore()
  setInstalledAgentStateSpy.mockRestore()
  removeInstalledAgentStateSpy.mockRestore()
  getConfigDirSpy.mockRestore()
})

describe('installAgent', () => {
  it('tries methods by definition order, returns true on first success', async () => {
    isBunSpy.mockResolvedValue(true)
    bunInstallSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()
    expect(await installAgent(testAgent)).toEqual({
      success: true,
      installedState: {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
      },
    })
    expect(bunInstallSpy).toHaveBeenCalledWith('test-pkg')
    expect(npmInstallSpy).not.toHaveBeenCalled()
  })

  it('skips unavailable package managers', async () => {
    isBunSpy.mockResolvedValue(false)
    isNpmSpy.mockResolvedValue(true)
    npmInstallSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()
    expect(await installAgent(testAgent)).toEqual({
      success: true,
      installedState: {
        agentName: 'test-agent',
        installType: 'npm',
        packageName: 'test-pkg',
      },
    })
    expect(bunInstallSpy).not.toHaveBeenCalled()
    expect(npmInstallSpy).toHaveBeenCalledWith('test-pkg')
  })

  it('tries next method if first fails', async () => {
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(true)
    bunInstallSpy.mockResolvedValue(false)
    npmInstallSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()
    expect(await installAgent(testAgent)).toMatchObject({ success: true })
    expect(bunInstallSpy).toHaveBeenCalledWith('test-pkg')
    expect(npmInstallSpy).toHaveBeenCalledWith('test-pkg')
  })

  it('returns false if all methods fail', async () => {
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(true)
    bunInstallSpy.mockResolvedValue(false)
    npmInstallSpy.mockResolvedValue(false)
    expect(await installAgent(testAgent)).toEqual({ success: false })
  })

  it('installs cargo-managed agents from cargo package metadata', async () => {
    const cargoAgent = {
      ...testAgent,
      packages: { cargo: 'test-crate' },
      platforms: {
        linux: [{ type: 'cargo' as const }],
      },
    }

    isCargoSpy.mockResolvedValue(true)
    cargoInstallSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(await installAgent(cargoAgent)).toEqual({
      success: true,
      installedState: {
        agentName: 'test-agent',
        installType: 'cargo',
        packageName: 'test-crate',
      },
    })
    expect(cargoInstallSpy).toHaveBeenCalledWith('test-crate', undefined)
    expect(npmInstallSpy).not.toHaveBeenCalled()
  })
})

describe('trackInstalledAgent', () => {
  it('persists an existing unmanaged install without running installers', async () => {
    setInstalledAgentStateSpy.mockResolvedValue()

    const installedState = await trackInstalledAgent(
      {
        ...testAgent,
        packages: undefined,
      },
      { type: 'script', command: 'curl https://example.com/install | bash' },
    )

    expect(installedState).toEqual({
      agentName: 'test-agent',
      command: 'curl https://example.com/install | bash',
      installType: 'script',
      packageName: undefined,
      packageTargetKind: undefined,
    })
    expect(setInstalledAgentStateSpy).toHaveBeenCalledWith(installedState)
    expect(bunInstallSpy).not.toHaveBeenCalled()
    expect(npmInstallSpy).not.toHaveBeenCalled()
    expect(binarySpy).not.toHaveBeenCalled()
  })
})

describe('updateAgent', () => {
  it('follows the definition order', async () => {
    isBunSpy.mockResolvedValue(true)
    bunUpdateSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()
    expect(await updateAgent(testAgent)).toMatchObject({ success: true })
    expect(bunUpdateSpy).toHaveBeenCalledWith('test-pkg', 'latest-major')
  })

  it('uses preferred installed state before falling back', async () => {
    isBunSpy.mockResolvedValue(true)
    bunUpdateSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(
      await updateAgent(testAgent, {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
      }),
    ).toMatchObject({ success: true })

    expect(bunUpdateSpy).toHaveBeenCalledWith('test-pkg', 'latest-major')
    expect(npmUpdateSpy).not.toHaveBeenCalled()
  })

  it('passes respect-semver from config to registry installers', async () => {
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      networkRetries: 2,
      networkTimeoutMs: 10000,
      npmBunUpdateStrategy: 'respect-semver',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    })
    isBunSpy.mockResolvedValue(true)
    bunUpdateSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(await updateAgent(testAgent)).toMatchObject({ success: true })
    expect(bunUpdateSpy).toHaveBeenCalledWith('test-pkg', 'respect-semver')
  })

  it('uses agent-defined update command for non-managed installs', async () => {
    const selfUpdatingAgent = {
      ...testAgent,
      packages: undefined,
      selfUpdate: {
        command: ['test-bin', 'update'],
      },
      platforms: {
        linux: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
      },
    }

    binarySpy.mockResolvedValue(true)

    expect(await updateAgent(selfUpdatingAgent)).toMatchObject({ success: true })
    expect(binarySpy).toHaveBeenCalledWith('test-bin update')
    expect(bunUpdateSpy).not.toHaveBeenCalled()
    expect(npmUpdateSpy).not.toHaveBeenCalled()
  })

  it('falls back to the next agent-defined update command when the first fails', async () => {
    const selfUpdatingAgent = {
      ...testAgent,
      packages: undefined,
      selfUpdate: {
        command: ['test-bin', 'update'],
        fallbackCommands: [['test-bin', 'upgrade']],
      },
      platforms: {
        linux: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
      },
    }

    binarySpy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    expect(await updateAgent(selfUpdatingAgent)).toMatchObject({ success: true })
    expect(binarySpy).toHaveBeenNthCalledWith(1, 'test-bin update')
    expect(binarySpy).toHaveBeenNthCalledWith(2, 'test-bin upgrade')
  })

  it('prefers managed update methods before self-update when no installed state exists', async () => {
    const dualModeAgent = {
      ...testAgent,
      selfUpdate: {
        command: ['test-bin', 'update'],
      },
    }

    isBunSpy.mockResolvedValue(true)
    bunUpdateSpy.mockResolvedValue(true)
    binarySpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(await updateAgent(dualModeAgent)).toMatchObject({ success: true })
    expect(bunUpdateSpy).toHaveBeenCalledWith('test-pkg', 'latest-major')
    expect(binarySpy).not.toHaveBeenCalled()
  })

  it('falls back to self-update after preferred managed state fails', async () => {
    const dualModeAgent = {
      ...testAgent,
      selfUpdate: {
        command: ['test-bin', 'update'],
      },
    }

    isBunSpy.mockResolvedValue(true)
    bunUpdateSpy.mockResolvedValue(false)
    binarySpy.mockResolvedValue(true)

    expect(
      await updateAgent(dualModeAgent, {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
      }),
    ).toMatchObject({ success: true })
    expect(bunUpdateSpy).toHaveBeenCalledWith('test-pkg', 'latest-major')
    expect(binarySpy).toHaveBeenCalledWith('test-bin update')
  })

  it('updates cargo-managed agents from recorded state', async () => {
    isCargoSpy.mockResolvedValue(true)
    cargoUpdateSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(
      await updateAgent(
        {
          ...testAgent,
          packages: { cargo: 'test-crate' },
          platforms: {
            linux: [{ packageInstallArgs: ['--locked'], type: 'cargo' as const }],
          },
        },
        {
          agentName: 'test-agent',
          installType: 'cargo',
          packageInstallArgs: ['--locked'],
          packageName: 'test-crate',
        },
      ),
    ).toMatchObject({ success: true })

    expect(cargoUpdateSpy).toHaveBeenCalledWith('test-crate', ['--locked'])
    expect(bunUpdateSpy).not.toHaveBeenCalled()
  })
})

describe('updateAgentsByType', () => {
  it('batches bun updates', async () => {
    isBunSpy.mockResolvedValue(true)
    bunUpdateManySpy.mockResolvedValue(true)

    expect(
      await updateAgentsByType('bun', [
        { packageName: 'test-pkg' },
        { packageName: 'test-pkg' },
        { packageName: 'other-pkg' },
      ]),
    ).toBe(true)
    expect(bunUpdateManySpy).toHaveBeenCalledWith(['test-pkg', 'other-pkg'], 'latest-major')
  })

  it('batches cargo updates', async () => {
    isCargoSpy.mockResolvedValue(true)
    cargoUpdateManySpy.mockResolvedValue(true)

    expect(
      await updateAgentsByType('cargo', [
        { packageInstallArgs: ['--locked'], packageName: 'test-crate' },
        { packageInstallArgs: ['--locked'], packageName: 'test-crate' },
        { packageName: 'other-crate' },
      ]),
    ).toBe(true)
    expect(cargoUpdateManySpy).toHaveBeenCalledWith([
      { packageInstallArgs: ['--locked'], packageName: 'test-crate' },
      { packageName: 'other-crate' },
    ])
  })

  it('returns false for an empty package list without calling updateMany', async () => {
    isBunSpy.mockResolvedValue(true)
    expect(await updateAgentsByType('bun', [])).toBe(false)
    expect(bunUpdateManySpy).not.toHaveBeenCalled()
  })

  it('returns false when every package spec lacks a non-empty package name', async () => {
    isBunSpy.mockResolvedValue(true)
    expect(await updateAgentsByType('bun', [{ packageName: '' }])).toBe(false)
    expect(bunUpdateManySpy).not.toHaveBeenCalled()
  })
})

describe('uninstallAgent', () => {
  it('uninstalls only the tracked installer source', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })
    isBunSpy.mockResolvedValue(true)
    bunUninstallSpy.mockResolvedValue(true)
    expect(await uninstallAgent(testAgent)).toBe(true)
    expect(bunUninstallSpy).toHaveBeenCalledWith('test-pkg')
    expect(npmUninstallSpy).not.toHaveBeenCalled()
    expect(removeInstalledAgentStateSpy).toHaveBeenCalledWith('test-agent')
  })

  it('uninstalls cargo-managed agents through cargo', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'cargo',
      packageName: 'test-crate',
    })
    isCargoSpy.mockResolvedValue(true)
    cargoUninstallSpy.mockResolvedValue(true)

    expect(await uninstallAgent(testAgent)).toBe(true)
    expect(cargoUninstallSpy).toHaveBeenCalledWith('test-crate')
    expect(bunUninstallSpy).not.toHaveBeenCalled()
    expect(removeInstalledAgentStateSpy).toHaveBeenCalledWith('test-agent')
  })
})
