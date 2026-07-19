import type { ProviderMutationEvidence, ProviderOperationContext, ProviderOutcome, ProviderTarget } from '../providers'
import { runPackageMutationOutcome } from '../package-manager/mutation-outcome'

export async function executeAgentSelfUpdate(request: {
  readonly commands: readonly (readonly string[])[]
  readonly context: ProviderOperationContext
  readonly target: ProviderTarget
}): Promise<ProviderOutcome<ProviderMutationEvidence>> {
  let lastFailure: Exclude<ProviderOutcome<void>, { readonly kind: 'success' }> | undefined

  for (const command of request.commands) {
    const outcome = await runPackageMutationOutcome(command, request.context, 'agent self-update failed')
    if (outcome.kind === 'success') {
      return {
        kind: 'success',
        value: {
          evidence: [{ kind: 'command', value: command.join(' ') }],
          target: request.target,
        },
      }
    }
    if (outcome.kind === 'cancelled' || outcome.kind === 'timed-out') return outcome
    lastFailure = outcome
  }

  return (
    lastFailure ?? {
      kind: 'unsupported',
      operation: 'update',
      reason: 'No self-update command is configured.',
    }
  )
}
