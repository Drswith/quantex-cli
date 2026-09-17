import type { ManagedInstallType } from '../../../../src/agents/types'
import type {
  ProviderOutputPolicy,
  ProviderProcessOperationContext,
} from '../../../../src/providers/internal-operation-context'
import type { RegistryPackageUpdateStrategy } from '../../../../src/providers/types'
import process from 'node:process'

export interface PackageManagerPreferences {
  readonly defaultPackageManager: ManagedInstallType
  readonly npmBunUpdateStrategy: RegistryPackageUpdateStrategy
}

export interface PackageManagerOperation {
  readonly context: ProviderProcessOperationContext
  dispose(): void
}

export interface PackageManagerHostPorts {
  isCancelled(): boolean
  timeoutMs(): number | undefined
  outputPolicy(): ProviderOutputPolicy
  loadPreferences(): Promise<PackageManagerPreferences>
  createOperationContext(): PackageManagerOperation
  runShellCommand(command: string): Promise<boolean>
}

const defaultPorts: PackageManagerHostPorts = {
  isCancelled: () => false,
  timeoutMs: () => undefined,
  outputPolicy: () => 'inherit',
  loadPreferences: async () => ({
    defaultPackageManager: 'bun',
    npmBunUpdateStrategy: 'latest-major',
  }),
  createOperationContext: () => {
    const controller = new AbortController()
    return {
      context: {
        outputPolicy: 'inherit',
        signal: controller.signal,
      },
      dispose() {
        return
      },
    }
  },
  async runShellCommand(command) {
    const { spawnWithOutputPolicy } = await import('../../../../src/utils/child-process')
    const argv =
      process.platform === 'win32'
        ? (['powershell.exe', '-Command', command] as const)
        : (['sh', '-c', command] as const)
    const handle = spawnWithOutputPolicy(argv, 'inherit')
    try {
      const exitCode = await handle.proc.exited
      await handle.outputDrained
      return exitCode === 0
    } finally {
      handle.cleanup()
    }
  },
}

let currentPorts: PackageManagerHostPorts = defaultPorts

export function setPackageManagerHostPorts(ports: PackageManagerHostPorts): void {
  currentPorts = ports
}

export function resetPackageManagerHostPorts(): void {
  currentPorts = defaultPorts
}

export function getPackageManagerHostPorts(): PackageManagerHostPorts {
  return currentPorts
}
