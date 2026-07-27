import type { LifecycleReceipt } from '../lifecycle/model'
import type { InstalledAgentState, VersionedQuantexState } from '../state/schema'
import type { LifecycleStateStore } from '../state/store'
import type { CoreInstallationStateRecord } from './installation-executor-types'
import { parseStateDocument } from '../state/schema'

export type AcquireCoreInstallationStateLock = () => Promise<() => Promise<void>>

export async function prepareCoreInstallationStateRecord(
  store: LifecycleStateStore,
  installedState: InstalledAgentState,
  receipt: LifecycleReceipt,
  acquireStateLock: AcquireCoreInstallationStateLock,
): Promise<CoreInstallationStateRecord> {
  if (installedState.agentName !== receipt.targetId) {
    throw new Error('Installed agent state and lifecycle receipt must target the same agent.')
  }

  const releaseStateLock = await acquireStateLock()
  try {
    const original = currentDocument(await store.loadDocument())
    const next = currentDocument({
      ...original,
      installedAgents: { ...original.installedAgents, [installedState.agentName]: installedState },
      lifecycleReceipts: { ...original.lifecycleReceipts, [receipt.targetId]: receipt },
    })

    return new InstallationStateRecord(store, original, next, releaseStateLock)
  } catch (error) {
    return await releaseAfterFailure(
      releaseStateLock,
      error,
      'Failed to release the state lock after record preparation.',
    )
  }
}

class InstallationStateRecord implements CoreInstallationStateRecord {
  private applyPromise?: Promise<void>
  private commitPromise?: Promise<void>
  private rawApplyPromise?: Promise<void>
  private releasePromise?: Promise<void>
  private rollbackPromise?: Promise<void>
  private terminal?: 'commit' | 'rollback'

  constructor(
    private readonly store: LifecycleStateStore,
    private readonly original: VersionedQuantexState,
    private readonly next: VersionedQuantexState,
    private readonly releaseStateLock: () => Promise<void>,
  ) {}

  apply(): Promise<void> {
    if (this.terminal === 'rollback') {
      throw new Error('Cannot apply an installation record after rollback started.')
    }
    if (this.applyPromise) return this.applyPromise

    this.rawApplyPromise = Promise.resolve().then(() => this.store.saveDocument(this.next))
    this.applyPromise = this.rawApplyPromise.catch(async error => {
      // A failed atomic save may have crossed its replacement boundary. Restore the
      // locked pre-write document before exposing the failure or releasing the lock.
      this.terminal = 'rollback'
      try {
        await this.startRollback()
      } catch (recoveryError) {
        throw combinedFailure(
          error,
          recoveryError,
          'State recording failed and the original document could not be restored cleanly.',
        )
      }
      throw error
    })
    return this.applyPromise
  }

  commit(): Promise<void> {
    if (this.terminal === 'rollback') {
      return this.startRollback().then(() => {
        throw new Error('Cannot commit an installation record after rollback started.')
      })
    }
    if (!this.applyPromise) {
      this.terminal = 'rollback'
      return this.startRollback().then(() => {
        throw new Error('Cannot commit an installation record before apply completes.')
      })
    }
    if (this.commitPromise) return this.commitPromise

    this.terminal = 'commit'
    this.commitPromise = this.applyPromise.then(() => this.releaseOnce())
    return this.commitPromise
  }

  rollback(): Promise<void> {
    // Commit is the irreversible terminal transition for this transaction. A late
    // cleanup callback may still call rollback, but it must never restore old state.
    if (this.terminal === 'commit') return this.commitPromise ?? Promise.resolve()

    this.terminal = 'rollback'
    return this.startRollback()
  }

  private startRollback(): Promise<void> {
    this.rollbackPromise ??= this.runRollback()
    return this.rollbackPromise
  }

  private async runRollback(): Promise<void> {
    if (!this.rawApplyPromise) {
      await this.releaseOnce()
      return
    }

    await this.rawApplyPromise.catch(() => undefined)

    let restoreError: unknown
    try {
      await this.store.saveDocument(this.original)
    } catch (error) {
      restoreError = error
    }

    try {
      await this.releaseOnce()
    } catch (releaseError) {
      if (restoreError !== undefined) {
        throw combinedFailure(restoreError, releaseError, 'Failed to restore the original state and release its lock.')
      }
      throw releaseError
    }

    if (restoreError !== undefined) throw restoreError
  }

  private releaseOnce(): Promise<void> {
    this.releasePromise ??= Promise.resolve().then(() => this.releaseStateLock())
    return this.releasePromise
  }
}

function currentDocument(value: VersionedQuantexState): VersionedQuantexState {
  const parsed = parseStateDocument(value)
  if (parsed.source !== 'current') throw new Error('Core mutations require the current state schema.')
  return parsed.document
}

async function releaseAfterFailure(
  release: () => Promise<void>,
  primaryError: unknown,
  message: string,
): Promise<never> {
  try {
    await release()
  } catch (releaseError) {
    throw combinedFailure(primaryError, releaseError, message)
  }
  throw primaryError
}

function combinedFailure(primaryError: unknown, recoveryError: unknown, message: string): AggregateError {
  return new AggregateError([primaryError, recoveryError], message, { cause: primaryError })
}
