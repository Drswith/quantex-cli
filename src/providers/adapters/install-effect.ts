import type { Platform } from '../../agents/types'
import type {
  ProviderAdapter,
  ProviderEvidence,
  ProviderExecutionEffect,
  ProviderOperationContext,
  ProviderOutcome,
} from '../types'
import { runPackageMutationOutcome } from '../../package-manager/context-mutation'
import { getPlatform, isBinaryInPath } from '../../utils/detect'
import {
  interruptedOutcome,
  isInterruptedOperation,
  runContextualOperation,
  runPendingOperation,
} from './pending-operation'

export interface InstallEffectAdapterDependencies {
  readonly contextualExecution?: boolean
  readonly execute: (
    effect: ProviderExecutionEffect,
    context: ProviderOperationContext,
  ) => Promise<ProviderOutcome<void>>
  readonly isExecutablePresent: (binaryName: string) => Promise<boolean>
}

const defaultDependencies: InstallEffectAdapterDependencies = {
  contextualExecution: true,
  execute: (effect, context) =>
    runPackageMutationOutcome(getEffectCommand(effect, getPlatform()), context, 'install effect failed'),
  isExecutablePresent: isBinaryInPath,
}

export function createInstallEffectProviderAdapter<Id extends 'binary' | 'script'>(
  id: Id,
  overrides: Partial<InstallEffectAdapterDependencies> = {},
): ProviderAdapter & { readonly id: Id } {
  const dependencies = {
    ...defaultDependencies,
    ...overrides,
    contextualExecution: overrides.execute ? (overrides.contextualExecution ?? false) : true,
  }
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

      const operation = await runEffectOperation(request.context, dependencies.contextualExecution, () =>
        dependencies.execute(effect, request.context),
      )
      if (isInterruptedOperation(operation)) return interruptedOutcome(operation)
      const command = getEffectCommand(effect, getPlatform())
      const evidence = effectEvidence(id, command)
      if (operation.kind === 'rejected') {
        return {
          command,
          evidence,
          kind: 'failed',
          reason: `${id} install failed for ${request.target.id}: ${operation.reason}`,
          remediation: 'Review the installer output and upstream installation instructions.',
          retryable: false,
        }
      }
      const outcome = operation.value
      if (outcome.kind !== 'success') {
        if (outcome.kind !== 'failed') return outcome
        return {
          ...outcome,
          command: outcome.command ?? command,
          evidence: outcome.evidence ?? evidence,
          remediation: outcome.remediation ?? 'Review the installer output and upstream installation instructions.',
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

function runEffectOperation<T>(
  context: ProviderOperationContext,
  contextual: boolean | undefined,
  invoke: () => Promise<T>,
): Promise<import('./pending-operation').PendingOperation<T>> {
  return contextual ? runContextualOperation(context, invoke) : runPendingOperation(context, invoke)
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
