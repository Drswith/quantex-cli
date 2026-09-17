import type { Platform } from '../../../../src/agents/types'
import { getPlatform } from '../../../../src/utils/detect'
import { getPackageManagerHostPorts } from './host'

export async function runBinaryInstall(commandOrFn: string | ((platform: Platform) => string)): Promise<boolean> {
  const platform = getPlatform()
  const command = typeof commandOrFn === 'function' ? commandOrFn(platform) : commandOrFn

  try {
    return await getPackageManagerHostPorts().runShellCommand(command)
  } catch {
    return false
  }
}
