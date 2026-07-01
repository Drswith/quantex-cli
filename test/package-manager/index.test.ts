import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { markCliContextCancelled, resetCliContext, setCliContext } from '../../src/cli-context'
import * as config from '../../src/config'
import * as binaryPm from '../../src/package-manager/binary'
import * as bunPm from '../../src/package-manager/bun'
import * as cargoPm from '../../src/package-manager/cargo'
import * as denoPm from '../../src/package-manager/deno'
import {
  installAgent,
  trackInstalledAgent,
  uninstallAgent,
  updateAgent,
  updateAgentsByType,
} from '../../src/package-manager/index'
import * as misePm from '../../src/package-manager/mise'
import * as npmPm from '../../src/package-manager/npm'
import * as uvPm from '../../src/package-manager/uv'
import { StateFileError } from '../../src/state'
import * as state from '../../src/state'
import * as detectUtils from '../../src/utils/detect'

const bunInstallSpy = vi.spyOn(bunPm, 'install')
const bunUpdateSpy = vi.spyOn(bunPm, 'update')
const bunUpdateManySpy = vi.spyOn(bunPm, 'updateMany')
const bunUninstallSpy = vi.spyOn(bunPm, 'uninstall')
const bunGetInstalledVersionSpy = vi.spyOn(bunPm, 'getInstalledVersion')
const cargoInstallSpy = vi.spyOn(cargoPm, 'install')
const cargoUpdateSpy = vi.spyOn(cargoPm, 'update')
const cargoUpdateManySpy = vi.spyOn(cargoPm, 'updateMany')
const cargoUninstallSpy = vi.spyOn(cargoPm, 'uninstall')
const denoInstallSpy = vi.spyOn(denoPm, 'install')
const denoUpdateSpy = vi.spyOn(denoPm, 'update')
const denoUpdateManySpy = vi.spyOn(denoPm, 'updateMany')
const denoUninstallSpy = vi.spyOn(denoPm, 'uninstall')
const miseInstallSpy = vi.spyOn(misePm, 'install')
const miseUpdateSpy = vi.spyOn(misePm, 'update')
const miseUpdateManySpy = vi.spyOn(misePm, 'updateMany')
const miseUninstallSpy = vi.spyOn(misePm, 'uninstall')
const npmInstallSpy = vi.spyOn(npmPm, 'install')
const npmUpdateSpy = vi.spyOn(npmPm, 'update')
const npmUpdateManySpy = vi.spyOn(npmPm, 'updateMany')
const npmUninstallSpy = vi.spyOn(npmPm, 'uninstall')
const npmProbePackagePresenceSpy = vi.spyOn(npmPm, 'probePackagePresence')
const uvInstallSpy = vi.spyOn(uvPm, 'install')
const uvUpdateSpy = vi.spyOn(uvPm, 'update')
const uvUpdateManySpy = vi.spyOn(uvPm, 'updateMany')
const uvUninstallSpy = vi.spyOn(uvPm, 'uninstall')
const binarySpy = vi.spyOn(binaryPm, 'runBinaryInstall')
const loadConfigSpy = vi.spyOn(config, 'loadConfig')
const getPlatformSpy = vi.spyOn(detectUtils, 'getPlatform')
const isBunSpy = vi.spyOn(detectUtils, 'isBunAvailable')
const isCargoSpy = vi.spyOn(detectUtils, 'isCargoAvailable')
const isDenoSpy = vi.spyOn(detectUtils, 'isDenoAvailable')
const isMiseSpy = vi.spyOn(detectUtils, 'isMiseAvailable')
const isNpmSpy = vi.spyOn(detectUtils, 'isNpmAvailable')
const isUvSpy = vi.spyOn(detectUtils, 'isUvAvailable')
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
  bunGetInstalledVersionSpy.mockClear()
  cargoInstallSpy.mockClear()
  cargoUpdateSpy.mockClear()
  cargoUpdateManySpy.mockClear()
  cargoUninstallSpy.mockClear()
  denoInstallSpy.mockClear()
  denoUpdateSpy.mockClear()
  denoUpdateManySpy.mockClear()
  denoUninstallSpy.mockClear()
  miseInstallSpy.mockClear()
  miseUpdateSpy.mockClear()
  miseUpdateManySpy.mockClear()
  miseUninstallSpy.mockClear()
  npmInstallSpy.mockClear()
  npmUpdateSpy.mockClear()
  npmUpdateManySpy.mockClear()
  npmUninstallSpy.mockClear()
  npmProbePackagePresenceSpy.mockClear()
  uvInstallSpy.mockClear()
  uvUpdateSpy.mockClear()
  uvUpdateManySpy.mockClear()
  uvUninstallSpy.mockClear()
  binarySpy.mockClear()
  loadConfigSpy.mockClear()
  getPlatformSpy.mockClear()
  isBunSpy.mockClear()
  isCargoSpy.mockClear()
  isDenoSpy.mockClear()
  isMiseSpy.mockClear()
  isNpmSpy.mockClear()
  isUvSpy.mockClear()
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
  bunGetInstalledVersionSpy.mockRestore()
  cargoInstallSpy.mockRestore()
  cargoUpdateSpy.mockRestore()
  cargoUpdateManySpy.mockRestore()
  cargoUninstallSpy.mockRestore()
  denoInstallSpy.mockRestore()
  denoUpdateSpy.mockRestore()
  denoUpdateManySpy.mockRestore()
  denoUninstallSpy.mockRestore()
  miseInstallSpy.mockRestore()
  miseUpdateSpy.mockRestore()
  miseUpdateManySpy.mockRestore()
  miseUninstallSpy.mockRestore()
  npmInstallSpy.mockRestore()
  npmUpdateSpy.mockRestore()
  npmUpdateManySpy.mockRestore()
  npmUninstallSpy.mockRestore()
  npmProbePackagePresenceSpy.mockRestore()
  uvInstallSpy.mockRestore()
  uvUpdateSpy.mockRestore()
  uvUpdateManySpy.mockRestore()
  uvUninstallSpy.mockRestore()
  binarySpy.mockRestore()
  loadConfigSpy.mockRestore()
  getPlatformSpy.mockRestore()
  isBunSpy.mockRestore()
  isCargoSpy.mockRestore()
  isDenoSpy.mockRestore()
  isMiseSpy.mockRestore()
  isNpmSpy.mockRestore()
  isUvSpy.mockRestore()
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

  it('rolls back a managed install when state persistence fails', async () => {
    isBunSpy.mockResolvedValue(true)
    bunInstallSpy.mockResolvedValue(true)
    bunUninstallSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockRejectedValue(new StateFileError('Failed to persist installed agent state.'))

    await expect(installAgent(testAgent)).rejects.toBeInstanceOf(StateFileError)
    expect(bunInstallSpy).toHaveBeenCalledWith('test-pkg')
    expect(bunUninstallSpy).toHaveBeenCalledWith('test-pkg')
  })

  it('does not persist installed state when CLI context is already cancelled', async () => {
    setCliContext({
      cancelled: true,
      interactive: false,
      outputMode: 'human',
      runId: 'cancelled-install-id',
    })
    isBunSpy.mockResolvedValue(true)
    bunInstallSpy.mockResolvedValue(true)
    bunUninstallSpy.mockResolvedValue(true)

    expect(await installAgent(testAgent)).toEqual({ success: false })
    expect(setInstalledAgentStateSpy).not.toHaveBeenCalled()
    expect(bunUninstallSpy).toHaveBeenCalledWith('test-pkg')
    resetCliContext()
  })

  it('skips persistence and rolls back when cancellation is marked after managed install succeeds', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'human',
      runId: 'late-cancel-install-id',
    })
    isBunSpy.mockResolvedValue(true)
    bunInstallSpy.mockImplementation(async () => {
      markCliContextCancelled()
      return true
    })
    bunUninstallSpy.mockResolvedValue(true)

    expect(await installAgent(testAgent)).toEqual({ success: false })
    expect(setInstalledAgentStateSpy).not.toHaveBeenCalled()
    expect(bunUninstallSpy).toHaveBeenCalledWith('test-pkg')
    resetCliContext()
  })

  it('rolls back managed install when cancellation is marked during state persistence', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'human',
      runId: 'persist-cancel-install-id',
    })
    isBunSpy.mockResolvedValue(true)
    bunInstallSpy.mockResolvedValue(true)
    bunUninstallSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockImplementation(async () => {
      markCliContextCancelled()
    })

    expect(await installAgent(testAgent)).toEqual({ success: false })
    expect(setInstalledAgentStateSpy).toHaveBeenCalled()
    expect(removeInstalledAgentStateSpy).toHaveBeenCalledWith('test-agent')
    expect(bunUninstallSpy).toHaveBeenCalledWith('test-pkg')
    resetCliContext()
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

  it('installs uv-managed agents from uv package metadata and install args', async () => {
    const uvAgent = {
      ...testAgent,
      packages: { uv: 'test-tool' },
      platforms: {
        linux: [{ packageInstallArgs: ['--python', '3.12'], type: 'uv' as const }],
      },
    }

    isUvSpy.mockResolvedValue(true)
    uvInstallSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(await installAgent(uvAgent)).toEqual({
      success: true,
      installedState: {
        agentName: 'test-agent',
        installType: 'uv',
        packageInstallArgs: ['--python', '3.12'],
        packageName: 'test-tool',
      },
    })
    expect(uvInstallSpy).toHaveBeenCalledWith('test-tool', ['--python', '3.12'])
    expect(npmInstallSpy).not.toHaveBeenCalled()
  })

  it('installs Deno-managed agents from Deno package metadata and install args', async () => {
    const denoAgent = {
      ...testAgent,
      binaryName: 'test-deno-bin',
      packages: { deno: 'jsr:@scope/test-tool' },
      platforms: {
        linux: [{ packageInstallArgs: ['--allow-net'], type: 'deno' as const }],
      },
    }

    isDenoSpy.mockResolvedValue(true)
    denoInstallSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(await installAgent(denoAgent)).toEqual({
      success: true,
      installedState: {
        agentName: 'test-agent',
        binaryName: 'test-deno-bin',
        installType: 'deno',
        packageInstallArgs: ['--allow-net'],
        packageName: 'jsr:@scope/test-tool',
      },
    })
    expect(denoInstallSpy).toHaveBeenCalledWith('jsr:@scope/test-tool', ['--allow-net'])
    expect(npmInstallSpy).not.toHaveBeenCalled()
  })

  it('installs mise-managed agents from mise package metadata', async () => {
    const miseAgent = {
      ...testAgent,
      packages: { mise: 'npm:@openai/codex', npm: '@openai/codex' },
      platforms: {
        linux: [{ type: 'mise' as const }],
      },
    }

    isMiseSpy.mockResolvedValue(true)
    miseInstallSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(await installAgent(miseAgent)).toEqual({
      success: true,
      installedState: {
        agentName: 'test-agent',
        installType: 'mise',
        packageName: 'npm:@openai/codex',
      },
    })
    expect(miseInstallSpy).toHaveBeenCalledWith('npm:@openai/codex')
    expect(npmInstallSpy).not.toHaveBeenCalled()
  })

  it('prefers mise when defaultPackageManager is mise and the agent exposes mise', async () => {
    const multiMethodAgent = {
      ...testAgent,
      packages: { mise: 'npm:@openai/codex', npm: '@openai/codex' },
      platforms: {
        linux: [{ type: 'bun' as const }, { type: 'npm' as const }, { type: 'mise' as const }],
      },
    }

    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'mise',
      networkRetries: 2,
      networkTimeoutMs: 10000,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    })
    isBunSpy.mockResolvedValue(true)
    isMiseSpy.mockResolvedValue(true)
    bunInstallSpy.mockResolvedValue(true)
    miseInstallSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(await installAgent(multiMethodAgent)).toEqual({
      success: true,
      installedState: {
        agentName: 'test-agent',
        installType: 'mise',
        packageName: 'npm:@openai/codex',
      },
    })
    expect(miseInstallSpy).toHaveBeenCalledWith('npm:@openai/codex')
    expect(bunInstallSpy).not.toHaveBeenCalled()
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

  it('does not persist state when cancellation is marked during state persistence', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'human',
      runId: 'persist-cancel-track-id',
    })
    setInstalledAgentStateSpy.mockImplementation(async () => {
      markCliContextCancelled()
    })

    expect(
      await trackInstalledAgent(
        {
          ...testAgent,
          packages: undefined,
        },
        { type: 'script', command: 'curl https://example.com/install | bash' },
      ),
    ).toBeNull()
    expect(setInstalledAgentStateSpy).toHaveBeenCalled()
    expect(removeInstalledAgentStateSpy).toHaveBeenCalledWith('test-agent')
    resetCliContext()
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

  it('does not replace recorded unmanaged state with candidate managed methods', async () => {
    isBunSpy.mockResolvedValue(true)
    bunUpdateSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(
      await updateAgent(testAgent, {
        agentName: 'test-agent',
        command: 'curl https://example.com/install | bash',
        installType: 'script',
      }),
    ).toEqual({ success: false })

    expect(bunUpdateSpy).not.toHaveBeenCalled()
    expect(npmUpdateSpy).not.toHaveBeenCalled()
    expect(setInstalledAgentStateSpy).not.toHaveBeenCalled()
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

  it('updates legacy managed state without packageName using catalog metadata', async () => {
    isBunSpy.mockResolvedValue(true)
    bunUpdateSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(
      await updateAgent(testAgent, {
        agentName: 'test-agent',
        installType: 'bun',
      }),
    ).toMatchObject({ success: true })

    expect(bunUpdateSpy).toHaveBeenCalledWith('test-pkg', 'latest-major')
  })

  it('does not fall back to self-update when recorded managed state lacks a package name', async () => {
    const dualModeAgent = {
      ...testAgent,
      packages: undefined,
      selfUpdate: {
        command: ['test-bin', 'update'],
      },
    }

    isBunSpy.mockResolvedValue(true)
    binarySpy.mockResolvedValue(true)

    expect(
      await updateAgent(dualModeAgent, {
        agentName: 'test-agent',
        installType: 'bun',
      }),
    ).toEqual({ success: false })

    expect(bunUpdateSpy).not.toHaveBeenCalled()
    expect(binarySpy).not.toHaveBeenCalled()
  })

  it('keeps recorded install state when cancellation is marked during preferred-state persistence', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'human',
      runId: 'persist-cancel-update-id',
    })
    isBunSpy.mockResolvedValue(true)
    bunUpdateSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockImplementation(async () => {
      markCliContextCancelled()
    })

    expect(
      await updateAgent(testAgent, {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
      }),
    ).toEqual({ success: false })

    expect(bunUpdateSpy).toHaveBeenCalledWith('test-pkg', 'latest-major')
    expect(setInstalledAgentStateSpy).toHaveBeenCalled()
    expect(removeInstalledAgentStateSpy).not.toHaveBeenCalled()
    resetCliContext()
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

  it('updates uv-managed agents from recorded state', async () => {
    isUvSpy.mockResolvedValue(true)
    uvUpdateSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(
      await updateAgent(
        {
          ...testAgent,
          packages: { uv: 'test-tool' },
          platforms: {
            linux: [{ packageInstallArgs: ['--python', '3.12'], type: 'uv' as const }],
          },
        },
        {
          agentName: 'test-agent',
          installType: 'uv',
          packageInstallArgs: ['--python', '3.12'],
          packageName: 'test-tool',
        },
      ),
    ).toMatchObject({ success: true })

    expect(uvUpdateSpy).toHaveBeenCalledWith('test-tool', ['--python', '3.12'])
    expect(bunUpdateSpy).not.toHaveBeenCalled()
  })

  it('updates Deno-managed agents from recorded state', async () => {
    isDenoSpy.mockResolvedValue(true)
    denoUpdateSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(
      await updateAgent(
        {
          ...testAgent,
          packages: { deno: 'jsr:@scope/test-tool' },
          platforms: {
            linux: [{ packageInstallArgs: ['--allow-net'], type: 'deno' as const }],
          },
        },
        {
          agentName: 'test-agent',
          binaryName: 'test-deno-bin',
          installType: 'deno',
          packageInstallArgs: ['--allow-net'],
          packageName: 'jsr:@scope/test-tool',
        },
      ),
    ).toMatchObject({ success: true })

    expect(denoUpdateSpy).toHaveBeenCalledWith('jsr:@scope/test-tool', ['--allow-net'])
    expect(bunUpdateSpy).not.toHaveBeenCalled()
  })

  it('updates mise-managed agents from recorded state', async () => {
    isMiseSpy.mockResolvedValue(true)
    miseUpdateSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(
      await updateAgent(
        {
          ...testAgent,
          packages: { mise: 'npm:@openai/codex', npm: '@openai/codex' },
          platforms: {
            linux: [{ type: 'mise' as const }],
          },
        },
        {
          agentName: 'test-agent',
          installType: 'mise',
          packageName: 'npm:@openai/codex',
        },
      ),
    ).toMatchObject({ success: true })

    expect(miseUpdateSpy).toHaveBeenCalledWith('npm:@openai/codex')
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

  it('batches uv updates', async () => {
    isUvSpy.mockResolvedValue(true)
    uvUpdateManySpy.mockResolvedValue(true)

    expect(
      await updateAgentsByType('uv', [
        { packageInstallArgs: ['--python', '3.12'], packageName: 'test-tool' },
        { packageInstallArgs: ['--python', '3.12'], packageName: 'test-tool' },
        { packageName: 'other-tool' },
      ]),
    ).toBe(true)
    expect(uvUpdateManySpy).toHaveBeenCalledWith([
      { packageInstallArgs: ['--python', '3.12'], packageName: 'test-tool' },
      { packageName: 'other-tool' },
    ])
  })

  it('batches Deno updates', async () => {
    isDenoSpy.mockResolvedValue(true)
    denoUpdateManySpy.mockResolvedValue(true)

    expect(
      await updateAgentsByType('deno', [
        { binaryName: 'test-tool', packageInstallArgs: ['--allow-net'], packageName: 'jsr:@scope/test-tool' },
        { binaryName: 'test-tool', packageInstallArgs: ['--allow-net'], packageName: 'jsr:@scope/test-tool' },
        { binaryName: 'other-tool', packageName: 'npm:@scope/other-tool' },
      ]),
    ).toBe(true)
    expect(denoUpdateManySpy).toHaveBeenCalledWith([
      { binaryName: 'test-tool', packageInstallArgs: ['--allow-net'], packageName: 'jsr:@scope/test-tool' },
      { binaryName: 'other-tool', packageName: 'npm:@scope/other-tool' },
    ])
  })

  it('batches mise updates', async () => {
    isMiseSpy.mockResolvedValue(true)
    miseUpdateManySpy.mockResolvedValue(true)

    expect(
      await updateAgentsByType('mise', [
        { packageName: 'npm:@openai/codex' },
        { packageName: 'npm:@openai/codex' },
        { packageName: 'npm:@anthropic-ai/claude-code' },
      ]),
    ).toBe(true)
    expect(miseUpdateManySpy).toHaveBeenCalledWith([
      { packageName: 'npm:@openai/codex' },
      { packageName: 'npm:@anthropic-ai/claude-code' },
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
  it('uninstalls legacy managed state without packageName using catalog metadata', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
    })
    isBunSpy.mockResolvedValue(true)
    bunUninstallSpy.mockResolvedValue(true)

    expect(await uninstallAgent(testAgent)).toBe(true)
    expect(bunUninstallSpy).toHaveBeenCalledWith('test-pkg')
    expect(removeInstalledAgentStateSpy).toHaveBeenCalledWith('test-agent')
  })

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

  it('uninstalls uv-managed agents through uv', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'uv',
      packageName: 'test-tool',
    })
    isUvSpy.mockResolvedValue(true)
    uvUninstallSpy.mockResolvedValue(true)

    expect(await uninstallAgent(testAgent)).toBe(true)
    expect(uvUninstallSpy).toHaveBeenCalledWith('test-tool')
    expect(bunUninstallSpy).not.toHaveBeenCalled()
    expect(removeInstalledAgentStateSpy).toHaveBeenCalledWith('test-agent')
  })

  it('uninstalls Deno-managed agents by recorded binary name', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      binaryName: 'test-deno-bin',
      installType: 'deno',
      packageName: 'jsr:@scope/test-tool',
    })
    isDenoSpy.mockResolvedValue(true)
    denoUninstallSpy.mockResolvedValue(true)

    expect(await uninstallAgent(testAgent)).toBe(true)
    expect(denoUninstallSpy).toHaveBeenCalledWith('test-deno-bin')
    expect(bunUninstallSpy).not.toHaveBeenCalled()
    expect(removeInstalledAgentStateSpy).toHaveBeenCalledWith('test-agent')
  })

  it('uninstalls mise-managed agents through mise', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'mise',
      packageName: 'npm:@openai/codex',
    })
    isMiseSpy.mockResolvedValue(true)
    miseUninstallSpy.mockResolvedValue(true)

    expect(await uninstallAgent(testAgent)).toBe(true)
    expect(miseUninstallSpy).toHaveBeenCalledWith('npm:@openai/codex')
    expect(bunUninstallSpy).not.toHaveBeenCalled()
    expect(removeInstalledAgentStateSpy).toHaveBeenCalledWith('test-agent')
  })

  it('untracks script installs when managed uninstall is unavailable', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      command: 'curl https://example.com/install | bash',
      installType: 'script',
    })

    expect(await uninstallAgent(testAgent)).toBe(true)
    expect(binarySpy).not.toHaveBeenCalled()
    expect(bunUninstallSpy).not.toHaveBeenCalled()
    expect(removeInstalledAgentStateSpy).toHaveBeenCalledWith('test-agent')
  })

  it('untracks binary installs when managed uninstall is unavailable', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'binary',
    })

    expect(await uninstallAgent(testAgent)).toBe(true)
    expect(binarySpy).not.toHaveBeenCalled()
    expect(bunUninstallSpy).not.toHaveBeenCalled()
    expect(removeInstalledAgentStateSpy).toHaveBeenCalledWith('test-agent')
  })

  it('recovers ghost state when managed uninstall fails but the package is already absent', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })
    isBunSpy.mockResolvedValue(true)
    bunUninstallSpy.mockResolvedValue(false)
    bunGetInstalledVersionSpy.mockResolvedValue(undefined)

    expect(await uninstallAgent(testAgent)).toBe(true)
    expect(bunUninstallSpy).toHaveBeenCalledWith('test-pkg')
    expect(bunGetInstalledVersionSpy).toHaveBeenCalledWith('test-pkg')
    expect(removeInstalledAgentStateSpy).toHaveBeenCalledWith('test-agent')
  })

  it('does not recover ghost state when the managed package is still installed', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })
    isBunSpy.mockResolvedValue(true)
    bunUninstallSpy.mockResolvedValue(false)
    bunGetInstalledVersionSpy.mockResolvedValue('1.2.3')

    expect(await uninstallAgent(testAgent)).toBe(false)
    expect(removeInstalledAgentStateSpy).not.toHaveBeenCalled()
  })

  it('does not recover ghost state when the package manager is unavailable', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })
    isBunSpy.mockResolvedValue(false)
    bunUninstallSpy.mockResolvedValue(false)

    expect(await uninstallAgent(testAgent)).toBe(false)
    expect(bunGetInstalledVersionSpy).not.toHaveBeenCalled()
    expect(removeInstalledAgentStateSpy).not.toHaveBeenCalled()
  })

  it('recovers npm ghost state when uninstall fails but absence is confirmed', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'npm',
      packageName: 'test-pkg',
    })
    isNpmSpy.mockResolvedValue(true)
    npmUninstallSpy.mockResolvedValue(false)
    npmProbePackagePresenceSpy.mockResolvedValue('absent')

    expect(await uninstallAgent(testAgent)).toBe(true)
    expect(npmUninstallSpy).toHaveBeenCalledWith('test-pkg')
    expect(npmProbePackagePresenceSpy).toHaveBeenCalledWith('test-pkg')
    expect(removeInstalledAgentStateSpy).toHaveBeenCalledWith('test-agent')
  })

  it('does not recover npm ghost state when presence probing is inconclusive', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'npm',
      packageName: 'test-pkg',
    })
    isNpmSpy.mockResolvedValue(true)
    npmUninstallSpy.mockResolvedValue(false)
    npmProbePackagePresenceSpy.mockResolvedValue('unknown')

    expect(await uninstallAgent(testAgent)).toBe(false)
    expect(removeInstalledAgentStateSpy).not.toHaveBeenCalled()
  })

  it('does not recover npm ghost state when the package is still installed', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'npm',
      packageName: 'test-pkg',
    })
    isNpmSpy.mockResolvedValue(true)
    npmUninstallSpy.mockResolvedValue(false)
    npmProbePackagePresenceSpy.mockResolvedValue('present')

    expect(await uninstallAgent(testAgent)).toBe(false)
    expect(removeInstalledAgentStateSpy).not.toHaveBeenCalled()
  })
})
