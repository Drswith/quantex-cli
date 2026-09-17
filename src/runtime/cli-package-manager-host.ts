import process from 'node:process'
import { setPackageManagerHostPorts, type PackageManagerHostPorts } from '../../packages/core/src/package-manager/host'
import { getCliContext } from '../cli-context'
import { loadConfig } from '../config'
import { createCliOperationContext, resolveCliProviderOutputPolicy } from './cli-operation-context'

export const cliPackageManagerHostPorts: PackageManagerHostPorts = {
  isCancelled: () => getCliContext().cancelled === true,
  timeoutMs: () => getCliContext().timeoutMs,
  outputPolicy: () => resolveCliProviderOutputPolicy(getCliContext().outputMode),
  async loadPreferences() {
    const config = await loadConfig()
    return {
      defaultPackageManager: config.defaultPackageManager,
      npmBunUpdateStrategy: config.npmBunUpdateStrategy,
    }
  },
  createOperationContext: () => createCliOperationContext(),
  async runShellCommand(command) {
    const { spawnWithQuantexStdio, waitForSpawnedCommand } = await import('../utils/cli-child-process')
    const argv =
      process.platform === 'win32'
        ? (['powershell.exe', '-Command', command] as const)
        : (['sh', '-c', command] as const)
    return (await waitForSpawnedCommand(spawnWithQuantexStdio(argv))) === 0
  },
}

export function bindCliPackageManagerHost(): void {
  setPackageManagerHostPorts(cliPackageManagerHostPorts)
}
