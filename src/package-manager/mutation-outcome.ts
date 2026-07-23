import type { ProviderOperationContext } from '../providers'
import type { PackageMutationOutcome } from './context-mutation'

export type { PackageMutationOutcome } from './context-mutation'

export async function projectLegacyPackageMutation(
  invoke: (context: ProviderOperationContext) => Promise<PackageMutationOutcome>,
): Promise<boolean> {
  const { createCliOperationContext } = await import('../runtime/cli-operation-context')
  const operation = createCliOperationContext()
  try {
    return (await invoke(operation.context)).kind === 'success'
  } finally {
    operation.dispose()
  }
}
