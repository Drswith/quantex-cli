import type { ProcessResult } from '../../runtime'
import type { SelfUpgradeProviderExecutionContext } from './types'
import { parseUntrustedPackages } from '../../package-manager/bun'
import { ProcessInterruptionError } from '../../utils/child-process'

export async function runManagedSelfInstall(
  argv: readonly string[],
  context: SelfUpgradeProviderExecutionContext,
): Promise<boolean> {
  if (!context.process) return false
  const result = await runManagedSelfProcess(argv, context, {
    forwardPipedOutput: true,
    stdio: context.stdio,
  })
  return result?.exitCode === 0
}

export async function runBunManagedSelfInstall(
  argv: readonly string[],
  packageName: string,
  context: SelfUpgradeProviderExecutionContext,
): Promise<boolean> {
  if (!(await runManagedSelfInstall(argv, context))) return false

  const untrusted = await runManagedSelfProcess(['bun', 'pm', '-g', 'untrusted'], context, {
    forwardPipedOutput: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (!untrusted || untrusted.exitCode !== 0) return false

  const output = untrusted.stdout ? new TextDecoder().decode(untrusted.stdout) : ''
  if (!parseUntrustedPackages(output).has(packageName)) return true
  return runManagedSelfInstall(['bun', 'pm', '-g', 'trust', packageName], context)
}

async function runManagedSelfProcess(
  argv: readonly string[],
  context: SelfUpgradeProviderExecutionContext,
  options: {
    readonly forwardPipedOutput: boolean
    readonly stdio: SelfUpgradeProviderExecutionContext['stdio']
  },
): Promise<ProcessResult | undefined> {
  if (!context.process) return undefined
  const outcome = await context.process.run({
    argv,
    forwardPipedOutput: options.forwardPipedOutput,
    signal: context.signal,
    stdio: options.stdio,
    timeoutMs: context.timeoutMs,
  })
  if (outcome.kind === 'success') return outcome.value
  if (outcome.error.kind === 'cancelled')
    throw new ProcessInterruptionError({ kind: 'cancelled', reason: outcome.error.message })
  if (outcome.error.kind === 'timed-out')
    throw new ProcessInterruptionError({ kind: 'timed-out', timeoutMs: context.timeoutMs ?? 0 })
  return undefined
}
