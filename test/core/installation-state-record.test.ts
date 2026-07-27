import type { LifecycleReceipt } from '../../src/lifecycle/model'
import type { InstalledAgentState, VersionedQuantexState } from '../../src/state/schema'
import type { StateDocumentPersistence } from '../../src/state/store'
import { describe, expect, it, vi } from 'vitest'
import { prepareCoreInstallationStateRecord } from '../../src/core/installation-state-record'
import { createEmptyStateDocument } from '../../src/state/schema'
import { LifecycleStateStore } from '../../src/state/store'

const installedState: InstalledAgentState = {
  agentName: 'fixture-agent',
  installType: 'npm',
  packageName: 'fixture-agent',
}

const receipt: LifecycleReceipt = {
  kind: 'lifecycle-receipt',
  providerId: 'npm',
  providerTargetId: 'fixture-agent',
  providerTargetKind: 'package',
  schemaVersion: 1,
  targetId: 'fixture-agent',
  verifiedAt: '2026-07-23T00:00:00.000Z',
}

describe('Core installation state record', () => {
  it('atomically writes installed state and receipt, then commits and releases once', async () => {
    const original = { ...createEmptyStateDocument(), self: { marker: 'preserve' } }
    const persistence = memoryPersistence(original)
    const lock = stateLock()
    const record = await prepareRecord(new LifecycleStateStore(persistence.port), lock.acquire)

    expect(lock.acquire).toHaveBeenCalledTimes(1)
    expect(persistence.saved).toHaveLength(0)

    await Promise.all([record.apply(), record.apply()])
    expect(persistence.saved).toHaveLength(1)
    expect(persistence.value).toMatchObject({
      installedAgents: { 'fixture-agent': installedState },
      lifecycleReceipts: { 'fixture-agent': receipt },
      self: { marker: 'preserve' },
    })

    await Promise.all([record.commit(), record.commit()])
    await record.rollback()

    expect(lock.release).toHaveBeenCalledTimes(1)
    expect(persistence.saved).toHaveLength(1)
    expect(persistence.value).toMatchObject({ installedAgents: { 'fixture-agent': installedState } })
  })

  it('restores the original document on rollback and releases once', async () => {
    const original = { ...createEmptyStateDocument(), self: { marker: 'preserve' } }
    const persistence = memoryPersistence(original)
    const lock = stateLock()
    const record = await prepareRecord(new LifecycleStateStore(persistence.port), lock.acquire)

    await record.apply()
    await Promise.all([record.rollback(), record.rollback()])

    expect(persistence.saved).toHaveLength(2)
    expect(persistence.value).toEqual(original)
    expect(lock.release).toHaveBeenCalledTimes(1)
  })

  it('does not write when rollback happens before apply starts', async () => {
    const persistence = memoryPersistence(createEmptyStateDocument())
    const lock = stateLock()
    const record = await prepareRecord(new LifecycleStateStore(persistence.port), lock.acquire)

    await record.rollback()

    expect(persistence.saved).toHaveLength(0)
    expect(lock.release).toHaveBeenCalledTimes(1)
    expect(() => record.apply()).toThrow('after rollback started')
  })

  it('waits for an in-flight write before restoring the original document', async () => {
    const original = createEmptyStateDocument()
    const writeStarted = deferred()
    const releaseWrite = deferred()
    const lock = stateLock()
    let value: VersionedQuantexState = original
    let saveCount = 0
    const store = new LifecycleStateStore({
      async load() {
        return value
      },
      async save(document) {
        saveCount += 1
        if (saveCount === 1) {
          writeStarted.resolve()
          await releaseWrite.promise
        }
        value = clone(document)
      },
    })
    const record = await prepareRecord(store, lock.acquire)

    const apply = record.apply()
    await writeStarted.promise
    const rollback = record.rollback()
    let rolledBack = false
    void rollback.then(() => (rolledBack = true))
    await Promise.resolve()

    expect(rolledBack).toBe(false)
    expect(lock.release).not.toHaveBeenCalled()

    releaseWrite.resolve()
    await Promise.all([apply, rollback])
    expect(saveCount).toBe(2)
    expect(value).toEqual(original)
    expect(lock.release).toHaveBeenCalledTimes(1)
  })

  it('restores and releases automatically when apply fails after a partial replacement', async () => {
    const original = createEmptyStateDocument()
    const lock = stateLock()
    const primaryError = new Error('primary save failed')
    let value = clone(original)
    let saveCount = 0
    const store = new LifecycleStateStore({
      async load() {
        return clone(value)
      },
      async save(document) {
        saveCount += 1
        value = clone(document)
        if (saveCount === 1) throw primaryError
      },
    })
    const record = await prepareRecord(store, lock.acquire)

    await expect(record.apply()).rejects.toBe(primaryError)
    await record.rollback()

    expect(saveCount).toBe(2)
    expect(value).toEqual(original)
    expect(lock.release).toHaveBeenCalledTimes(1)
  })

  it('attempts lock release when rollback restoration fails', async () => {
    const original = createEmptyStateDocument()
    const lock = stateLock()
    let saveCount = 0
    const store = new LifecycleStateStore({
      async load() {
        return original
      },
      async save() {
        saveCount += 1
        if (saveCount === 2) throw new Error('restore failed')
      },
    })
    const record = await prepareRecord(store, lock.acquire)

    await record.apply()
    await expect(record.rollback()).rejects.toThrow('restore failed')

    expect(lock.release).toHaveBeenCalledTimes(1)
  })

  it('fails closed and releases the acquired lock on load or validation errors', async () => {
    const loadError = new Error('load failed')
    const loadLock = stateLock()
    const failedLoad = new LifecycleStateStore({
      async load() {
        throw loadError
      },
      async save() {
        throw new Error('save must not run')
      },
    })

    await expect(prepareRecord(failedLoad, loadLock.acquire)).rejects.toBe(loadError)
    expect(loadLock.release).toHaveBeenCalledTimes(1)

    const corruptLock = stateLock()
    const save = vi.fn(async () => undefined)
    const corrupt = new LifecycleStateStore({ load: async () => ({ schemaVersion: 999 }), save })
    await expect(prepareRecord(corrupt, corruptLock.acquire)).rejects.toThrow()
    expect(corruptLock.release).toHaveBeenCalledTimes(1)
    expect(save).not.toHaveBeenCalled()
  })

  it('does not load or write if state lock acquisition fails', async () => {
    const load = vi.fn(async () => createEmptyStateDocument())
    const save = vi.fn(async () => undefined)
    const lockError = new Error('lock unavailable')

    await expect(
      prepareRecord(new LifecycleStateStore({ load, save }), async () => {
        throw lockError
      }),
    ).rejects.toBe(lockError)

    expect(load).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('rejects mismatched evidence without acquiring the state lock', async () => {
    const lock = stateLock()
    const store = new LifecycleStateStore(memoryPersistence(createEmptyStateDocument()).port)

    await expect(
      prepareCoreInstallationStateRecord(store, installedState, { ...receipt, targetId: 'other-agent' }, lock.acquire),
    ).rejects.toThrow('must target the same agent')

    expect(lock.acquire).not.toHaveBeenCalled()
  })
})

async function prepareRecord(
  store: LifecycleStateStore,
  acquireStateLock: () => Promise<() => Promise<void>>,
): ReturnType<typeof prepareCoreInstallationStateRecord> {
  return await prepareCoreInstallationStateRecord(store, installedState, receipt, acquireStateLock)
}

function stateLock(): {
  readonly acquire: ReturnType<typeof vi.fn<() => Promise<() => Promise<void>>>>
  readonly release: ReturnType<typeof vi.fn<() => Promise<void>>>
} {
  const release = vi.fn(async () => undefined)
  return {
    acquire: vi.fn(async () => release),
    release,
  }
}

function memoryPersistence(initial: VersionedQuantexState): {
  readonly port: StateDocumentPersistence
  readonly saved: VersionedQuantexState[]
  readonly value: VersionedQuantexState
} {
  let value = clone(initial)
  const saved: VersionedQuantexState[] = []
  return {
    port: {
      async load() {
        return clone(value)
      },
      async save(document) {
        value = clone(document)
        saved.push(value)
      },
    },
    saved,
    get value() {
      return value
    },
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function deferred(): { readonly promise: Promise<void>; resolve(): void } {
  let resolve!: () => void
  const promise = new Promise<void>(complete => {
    resolve = complete
  })
  return { promise, resolve }
}
