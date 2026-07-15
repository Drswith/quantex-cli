import type { PersistencePort, RuntimeFailure, RuntimeOutcome } from '../runtime'
import type { SelfInstallSource } from './types'
import { getSelfState, removeSelfInstallSource, setSelfInstallSource } from '../state'

export const SELF_INSTALL_SOURCE_PERSISTENCE_KEY = 'self:install-source'

interface SelfInstallSourcePersistenceDependencies {
  readonly clearInstallSource: () => Promise<void>
  readonly getSelfState: typeof getSelfState
  readonly setInstallSource: (installSource: SelfInstallSource) => Promise<void>
}

const DEFAULT_DEPENDENCIES: SelfInstallSourcePersistenceDependencies = {
  clearInstallSource: removeSelfInstallSource,
  getSelfState,
  setInstallSource: setSelfInstallSource,
}

export function createSelfInstallSourcePersistencePort(
  dependencies: SelfInstallSourcePersistenceDependencies = DEFAULT_DEPENDENCIES,
): PersistencePort {
  return {
    async load(request) {
      const invalid = validateRequest(request.key, request.signal)
      if (invalid) return invalid

      try {
        const installSource = (await dependencies.getSelfState()).installSource
        return success(
          installSource === undefined
            ? { kind: 'missing' as const }
            : { kind: 'found' as const, snapshot: { value: installSource } },
        )
      } catch (error) {
        return failed('Failed to read the persisted self install source.', error)
      }
    },
    async remove(request) {
      const invalid = validateRequest(request.key, request.signal)
      if (invalid) return invalid

      try {
        await dependencies.clearInstallSource()
        return success(undefined)
      } catch (error) {
        return failed('Failed to remove the persisted self install source.', error)
      }
    },
    async save(request) {
      const invalid = validateRequest(request.key, request.signal)
      if (invalid) return invalid
      if (!isSelfInstallSource(request.value)) {
        return failure({ kind: 'invalid-data', message: 'The persisted self install source is invalid.' })
      }

      try {
        await dependencies.setInstallSource(request.value)
        return success({})
      } catch (error) {
        return failed('Failed to persist the self install source.', error)
      }
    },
  }
}

function validateRequest(key: string, signal: AbortSignal): RuntimeOutcome<never> | undefined {
  if (signal.aborted) return failure({ kind: 'cancelled', message: 'Self install-source persistence was cancelled.' })
  if (key !== SELF_INSTALL_SOURCE_PERSISTENCE_KEY) {
    return failure({ kind: 'invalid-data', message: `Unsupported self persistence key "${key}".` })
  }
  return undefined
}

function isSelfInstallSource(value: unknown): value is SelfInstallSource {
  return value === 'binary' || value === 'bun' || value === 'npm' || value === 'source' || value === 'unknown'
}

function success<T>(value: T): RuntimeOutcome<T> {
  return { kind: 'success', value }
}

function failure<T>(error: RuntimeFailure): RuntimeOutcome<T> {
  return { error, kind: 'failure' }
}

function failed<T>(message: string, cause: unknown): RuntimeOutcome<T> {
  return failure({
    details: { cause },
    kind: 'failed',
    message,
  })
}
