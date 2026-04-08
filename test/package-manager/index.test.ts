import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as binaryPm from '../../src/package-manager/binary'
import * as bunPm from '../../src/package-manager/bun'
import { installAgent, uninstallAgent, updateAgent, updateAgentsByType } from '../../src/package-manager/index'
import * as npmPm from '../../src/package-manager/npm'
import * as state from '../../src/state'
import * as detectUtils from '../../src/utils/detect'

const bunInstallSpy = vi.spyOn(bunPm, 'install')
const bunUpdateSpy = vi.spyOn(bunPm, 'update')
const bunUpdateManySpy = vi.spyOn(bunPm, 'updateMany')
const bunUninstallSpy = vi.spyOn(bunPm, 'uninstall')
const npmInstallSpy = vi.spyOn(npmPm, 'install')
const npmUpdateSpy = vi.spyOn(npmPm, 'update')
const npmUpdateManySpy = vi.spyOn(npmPm, 'updateMany')
const npmUninstallSpy = vi.spyOn(npmPm, 'uninstall')
const binarySpy = vi.spyOn(binaryPm, 'runBinaryInstall')
const getPlatformSpy = vi.spyOn(detectUtils, 'getPlatform')
const isBunSpy = vi.spyOn(detectUtils, 'isBunAvailable')
const isNpmSpy = vi.spyOn(detectUtils, 'isNpmAvailable')
const getInstalledAgentStateSpy = vi.spyOn(state, 'getInstalledAgentState')
const setInstalledAgentStateSpy = vi.spyOn(state, 'setInstalledAgentState')
const removeInstalledAgentStateSpy = vi.spyOn(state, 'removeInstalledAgentState')

const testAgent = {
  name: 'test-agent',
  aliases: [] as string[],
  displayName: 'Test Agent',
  description: 'A test agent',
  homepage: 'https://example.com',
  package: 'test-pkg',
  binaryName: 'test-bin',
  platforms: {
    linux: [
      { type: 'bun' as const, command: 'bun add -g test-pkg', priority: 1 },
      { type: 'npm' as const, command: 'npm i -g test-pkg', priority: 2 },
    ],
  },
}

beforeEach(() => {
  bunInstallSpy.mockClear()
  bunUpdateSpy.mockClear()
  bunUpdateManySpy.mockClear()
  bunUninstallSpy.mockClear()
  npmInstallSpy.mockClear()
  npmUpdateSpy.mockClear()
  npmUpdateManySpy.mockClear()
  npmUninstallSpy.mockClear()
  binarySpy.mockClear()
  getPlatformSpy.mockClear()
  isBunSpy.mockClear()
  isNpmSpy.mockClear()
  getInstalledAgentStateSpy.mockClear()
  setInstalledAgentStateSpy.mockClear()
  removeInstalledAgentStateSpy.mockClear()
  getPlatformSpy.mockReturnValue('linux')
  getInstalledAgentStateSpy.mockResolvedValue(undefined)
  removeInstalledAgentStateSpy.mockResolvedValue()
})

afterAll(() => {
  bunInstallSpy.mockRestore()
  bunUpdateSpy.mockRestore()
  bunUpdateManySpy.mockRestore()
  bunUninstallSpy.mockRestore()
  npmInstallSpy.mockRestore()
  npmUpdateSpy.mockRestore()
  npmUpdateManySpy.mockRestore()
  npmUninstallSpy.mockRestore()
  binarySpy.mockRestore()
  getPlatformSpy.mockRestore()
  isBunSpy.mockRestore()
  isNpmSpy.mockRestore()
  getInstalledAgentStateSpy.mockRestore()
  setInstalledAgentStateSpy.mockRestore()
  removeInstalledAgentStateSpy.mockRestore()
})

describe('installAgent', () => {
  it('tries methods by priority, returns true on first success', async () => {
    isBunSpy.mockResolvedValue(true)
    bunInstallSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()
    expect(await installAgent(testAgent)).toEqual({
      success: true,
      installedState: {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
        command: 'bun add -g test-pkg',
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
        command: 'npm i -g test-pkg',
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
})

describe('updateAgent', () => {
  it('follows same priority pattern', async () => {
    isBunSpy.mockResolvedValue(true)
    bunUpdateSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()
    expect(await updateAgent(testAgent)).toMatchObject({ success: true })
    expect(bunUpdateSpy).toHaveBeenCalledWith('test-pkg')
  })

  it('uses preferred installed state before falling back', async () => {
    isBunSpy.mockResolvedValue(true)
    bunUpdateSpy.mockResolvedValue(true)
    setInstalledAgentStateSpy.mockResolvedValue()

    expect(await updateAgent(testAgent, {
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
      command: 'bun add -g test-pkg',
    })).toMatchObject({ success: true })

    expect(bunUpdateSpy).toHaveBeenCalledWith('test-pkg')
    expect(npmUpdateSpy).not.toHaveBeenCalled()
  })
})

describe('updateAgentsByType', () => {
  it('batches bun updates', async () => {
    isBunSpy.mockResolvedValue(true)
    bunUpdateManySpy.mockResolvedValue(true)

    expect(await updateAgentsByType('bun', [
      { packageName: 'test-pkg' },
      { packageName: 'test-pkg' },
      { packageName: 'other-pkg' },
    ])).toBe(true)
    expect(bunUpdateManySpy).toHaveBeenCalledWith(['test-pkg', 'other-pkg'])
  })
})

describe('uninstallAgent', () => {
  it('uninstalls only the tracked installer source', async () => {
    getInstalledAgentStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
      command: 'bun add -g test-pkg',
    })
    isBunSpy.mockResolvedValue(true)
    bunUninstallSpy.mockResolvedValue(true)
    expect(await uninstallAgent(testAgent)).toBe(true)
    expect(bunUninstallSpy).toHaveBeenCalledWith('test-pkg')
    expect(npmUninstallSpy).not.toHaveBeenCalled()
    expect(removeInstalledAgentStateSpy).toHaveBeenCalledWith('test-agent')
  })
})
