import type { Platform } from '../../agents/types'
import type {
  ProviderAdapter,
  ProviderEvidence,
  ProviderExecutionEffect,
  ProviderOperationContext,
  ProviderOutcome,
} from '../types'
import { runBinaryInstall } from '../../package-manager/binary'
import { spawnWithQuantexStdio, waitForSpawnedCommand } from '../../utils/child-process'
import { getPlatform, isBinaryInPath } from '../../utils/detect'
import { interruptedOutcome, isInterruptedOperation, runPendingOperation } from './legacy-operation'

export interface InstallEffectAdapterDependencies {
  readonly execute: (effect: ProviderExecutionEffect) => Promise<boolean>
  readonly isExecutablePresent: (binaryName: string) => Promise<boolean>
}

const defaultDependencies: InstallEffectAdapterDependencies = {
  execute: async effect => {
    if (effect.kind === 'shell-script') return runBinaryInstall(effect.command)
    try {
      return (await waitForSpawnedCommand(spawnWithQuantexStdio([...effect.command]))) === 0
    } catch {
      return false
    }
  },
  isExecutablePresent: isBinaryInPath,
}

export function createInstallEffectProviderAdapter<Id extends 'binary' | 'script'>(
  id: Id,
  overrides: Partial<InstallEffectAdapterDependencies> = {},
): ProviderAdapter & { readonly id: Id } {
  const dependencies = { ...defaultDependencies, ...overrides }
  return {
    availability: async context => availableShell(context),
    id,
    install: async request => {
      const effect = request.target.effect
      if (!effect) {
        return {
          kind: 'failed',
          reason: `${id} install target ${request.target.id} has no execution effect`,
          remediation: 'Select a candidate with an explicit shell-script or executable effect.',
          retryable: false,
        }
      }

      const operation = await runPendingOperation(request.context, () => dependencies.execute(effect))
      if (isInterruptedOperation(operation)) return interruptedOutcome(operation)
      const command = getEffectCommand(effect, getPlatform())
      const evidence = effectEvidence(id, command)
      if (operation.kind === 'rejected' || !operation.value) {
        return {
          command,
          evidence,
          kind: 'failed',
          reason: `${id} install failed for ${request.target.id}${operation.kind === 'rejected' ? `: ${operation.reason}` : ''}`,
          remediation: 'Review the installer output and upstream installation instructions.',
          retryable: false,
        }
      }

      return { kind: 'success', value: { evidence, target: request.target } }
    },
    observe: async request => {
      const binaryName = request.target.binaryName
      if (!binaryName) {
        return {
          evidence: [{ kind: 'provider', value: `${id}:${request.target.id}:presence-unknown` }],
          kind: 'indeterminate',
          reason: `${id} candidate does not declare an executable presence probe`,
        }
      }
      const operation = await runPendingOperation(request.context, () => dependencies.isExecutablePresent(binaryName))
      if (isInterruptedOperation(operation)) return interruptedOutcome(operation)
      if (operation.kind === 'rejected') {
        return {
          kind: 'failed',
          reason: `${id} executable probe failed for ${request.target.id}: ${operation.reason}`,
          retryable: true,
        }
      }
      return {
        kind: 'success',
        value: {
          evidence: [{ kind: 'executable', value: binaryName }],
          kind: operation.value ? 'present' : 'absent',
          target: request.target,
        },
      }
    },
  }
}

export function getEffectCommand(effect: ProviderExecutionEffect, platform: Platform): readonly string[] {
  if (effect.kind === 'executable') return effect.command
  return platform === 'windows' ? ['powershell.exe', '-Command', effect.command] : ['sh', '-c', effect.command]
}

async function availableShell(
  context: ProviderOperationContext,
): Promise<ProviderOutcome<{ readonly executable: string }>> {
  if (context.signal.aborted) return { kind: 'cancelled', reason: String(context.signal.reason) }
  return { kind: 'success', value: { executable: getPlatform() === 'windows' ? 'powershell.exe' : 'sh' } }
}

function effectEvidence(id: string, command: readonly string[]): readonly ProviderEvidence[] {
  return [
    { kind: 'provider', value: id },
    { kind: 'command', value: command.join(' ') },
  ]
}

export const scriptProviderAdapter = createInstallEffectProviderAdapter('script')
export const binaryProviderAdapter = createInstallEffectProviderAdapter('binary')
