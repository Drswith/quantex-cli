import type {
  ProviderAdapter,
  ProviderBatchUpdateRequest,
  ProviderOptionalOperation,
  ProviderOutcome,
  ProviderTargetOperation,
  ProviderTargetRequest,
} from './types'

const optionalOperationProperties = {
  install: 'install',
  'resolve-latest-version': 'resolveLatestVersion',
  uninstall: 'uninstall',
  update: 'update',
  'update-many': 'updateMany',
  verify: 'verify',
} as const satisfies Record<ProviderOptionalOperation, keyof ProviderAdapter>

export function invokeProviderOperation(
  adapter: ProviderAdapter,
  operation: ProviderTargetOperation,
  request: ProviderTargetRequest,
): Promise<ProviderOutcome<unknown>>
export function invokeProviderOperation(
  adapter: ProviderAdapter,
  operation: 'update-many',
  request: ProviderBatchUpdateRequest,
): Promise<ProviderOutcome<unknown>>
export function invokeProviderOperation(
  adapter: ProviderAdapter,
  operation: ProviderOptionalOperation,
  request: ProviderBatchUpdateRequest | ProviderTargetRequest,
): Promise<ProviderOutcome<unknown>> {
  const invoke = adapter[optionalOperationProperties[operation]] as
    | ((request: ProviderBatchUpdateRequest | ProviderTargetRequest) => Promise<ProviderOutcome<unknown>>)
    | undefined

  if (!invoke) {
    return Promise.resolve({
      kind: 'unsupported',
      operation,
      reason: `${adapter.id} does not implement ${operation}`,
    })
  }

  return invoke.call(adapter, request)
}
