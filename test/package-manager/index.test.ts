import { afterAll, beforeEach, describe, expect, it, jest } from 'bun:test'
import * as binaryPm from '../../src/package-manager/binary'
import * as bunPm from '../../src/package-manager/bun'
import { installAgent, uninstallAgent, updateAgent } from '../../src/package-manager/index'
import * as npmPm from '../../src/package-manager/npm'
import * as detectUtils from '../../src/utils/detect'

const bunInstallSpy = jest.spyOn(bunPm, 'install')
const bunUpdateSpy = jest.spyOn(bunPm, 'update')
const bunUninstallSpy = jest.spyOn(bunPm, 'uninstall')
const npmInstallSpy = jest.spyOn(npmPm, 'install')
const npmUpdateSpy = jest.spyOn(npmPm, 'update')
const npmUninstallSpy = jest.spyOn(npmPm, 'uninstall')
const binarySpy = jest.spyOn(binaryPm, 'runBinaryInstall')
const getPlatformSpy = jest.spyOn(detectUtils, 'getPlatform')
const isBunSpy = jest.spyOn(detectUtils, 'isBunAvailable')
const isNpmSpy = jest.spyOn(detectUtils, 'isNpmAvailable')

afterAll(() => {
  bunInstallSpy.mockRestore()
  bunUpdateSpy.mockRestore()
  bunUninstallSpy.mockRestore()
  npmInstallSpy.mockRestore()
  npmUpdateSpy.mockRestore()
  npmUninstallSpy.mockRestore()
  binarySpy.mockRestore()
  getPlatformSpy.mockRestore()
  isBunSpy.mockRestore()
  isNpmSpy.mockRestore()
})

const testAgent = {
  name: 'test-agent',
  aliases: [] as string[],
  displayName: 'Test Agent',
  description: 'A test agent',
  package: 'test-pkg',
  binaryName: 'test-bin',
  installMethods: [
    { type: 'bun' as const, command: 'bun add -g test-pkg', supportedPlatforms: ['linux' as const, 'macos' as const, 'windows' as const], priority: 1 },
    { type: 'npm' as const, command: 'npm i -g test-pkg', supportedPlatforms: ['linux' as const, 'macos' as const, 'windows' as const], priority: 2 },
  ],
}

beforeEach(() => {
  bunInstallSpy.mockClear()
  bunUpdateSpy.mockClear()
  bunUninstallSpy.mockClear()
  npmInstallSpy.mockClear()
  npmUpdateSpy.mockClear()
  npmUninstallSpy.mockClear()
  binarySpy.mockClear()
  getPlatformSpy.mockClear()
  isBunSpy.mockClear()
  isNpmSpy.mockClear()
  getPlatformSpy.mockReturnValue('linux')
})

describe('installAgent', () => {
  it('tries methods by priority, returns true on first success', async () => {
    isBunSpy.mockResolvedValue(true)
    bunInstallSpy.mockResolvedValue(true)
    expect(await installAgent(testAgent)).toBe(true)
    expect(bunInstallSpy).toHaveBeenCalledWith('test-pkg')
    expect(npmInstallSpy).not.toHaveBeenCalled()
  })

  it('skips unavailable package managers', async () => {
    isBunSpy.mockResolvedValue(false)
    isNpmSpy.mockResolvedValue(true)
    npmInstallSpy.mockResolvedValue(true)
    expect(await installAgent(testAgent)).toBe(true)
    expect(bunInstallSpy).not.toHaveBeenCalled()
    expect(npmInstallSpy).toHaveBeenCalledWith('test-pkg')
  })

  it('tries next method if first fails', async () => {
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(true)
    bunInstallSpy.mockResolvedValue(false)
    npmInstallSpy.mockResolvedValue(true)
    expect(await installAgent(testAgent)).toBe(true)
    expect(bunInstallSpy).toHaveBeenCalledWith('test-pkg')
    expect(npmInstallSpy).toHaveBeenCalledWith('test-pkg')
  })

  it('returns false if all methods fail', async () => {
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(true)
    bunInstallSpy.mockResolvedValue(false)
    npmInstallSpy.mockResolvedValue(false)
    expect(await installAgent(testAgent)).toBe(false)
  })
})

describe('updateAgent', () => {
  it('follows same priority pattern', async () => {
    isBunSpy.mockResolvedValue(true)
    bunUpdateSpy.mockResolvedValue(true)
    expect(await updateAgent(testAgent)).toBe(true)
    expect(bunUpdateSpy).toHaveBeenCalledWith('test-pkg')
  })
})

describe('uninstallAgent', () => {
  it('tries both bun and npm', async () => {
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(true)
    bunUninstallSpy.mockResolvedValue(true)
    npmUninstallSpy.mockResolvedValue(false)
    expect(await uninstallAgent(testAgent)).toBe(true)
    expect(bunUninstallSpy).toHaveBeenCalledWith('test-pkg')
    expect(npmUninstallSpy).toHaveBeenCalledWith('test-pkg')
  })
})
