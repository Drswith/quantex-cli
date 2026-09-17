// KEEP (S1): host-bound operation-context wrapper over package mutation outcomes.
// Type re-export is convenience; projectLegacyPackageMutation is differential.
import type { ProviderOperationContext } from '../../../../src/providers'
import type { PackageMutationOutcome } from './context-mutation'
import { getPackageManagerHostPorts } from './host'

export type { PackageMutationOutcome } from './context-mutation'

export async function projectLegacyPackageMutation(
  invoke: (context: ProviderOperationContext) => Promise<PackageMutationOutcome>,
): Promise<boolean> {
  const operation = getPackageManagerHostPorts().createOperationContext()
  try {
    return (await invoke(operation.context)).kind === 'success'
  } finally {
    operation.dispose()
  }
}
