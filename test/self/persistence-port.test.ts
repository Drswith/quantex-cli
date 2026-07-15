import type { PersistencePort, RuntimeOutcome } from '../../src/runtime'
import type { SelfInstallSource } from '../../src/self'
import { describe, expect, it, vi } from 'vitest'
import { reconcileSelfInstallSource, resolveSelfInstallFactsReadOnly } from '../../src/self/facts'
import {
  SELF_INSTALL_SOURCE_PERSISTENCE_KEY,
  createSelfInstallSourcePersistencePort,
} from '../../src/self/state-persistence'
import { StateFileError } from '../../src/state'

describe('self install-source persistence boundary', () => {
  it('reconciles detected sources through the shared persistence port', async () => {
    const save = vi.fn(async () => success({ revision: 'next' }))
    const persistence = createFakePersistencePort({ save })

    await expect(
      reconcileSelfInstallSource(undefined, 'npm', {
        persistence,
        signal: new AbortController().signal,
      }),
    ).resolves.toBe('npm')
    expect(save).toHaveBeenCalledWith({
      key: SELF_INSTALL_SOURCE_PERSISTENCE_KEY,
      signal: expect.any(AbortSignal),
      value: 'npm',
    })
  })

  it('maps the legacy self state projection to load, save, and remove operations', async () => {
    let installSource: SelfInstallSource | undefined = 'bun'
    const persistence = createSelfInstallSourcePersistencePort({
      clearInstallSource: async () => {
        installSource = undefined
      },
      getSelfState: async () => ({ installSource }),
      setInstallSource: async value => {
        installSource = value
      },
    })
    const signal = new AbortController().signal

    await expect(persistence.load({ key: SELF_INSTALL_SOURCE_PERSISTENCE_KEY, signal })).resolves.toEqual(
      success({ kind: 'found', snapshot: { value: 'bun' } }),
    )
    await expect(
      persistence.save({ key: SELF_INSTALL_SOURCE_PERSISTENCE_KEY, signal, value: 'binary' }),
    ).resolves.toEqual(success({}))
    expect(installSource).toBe('binary')
    await expect(persistence.remove({ key: SELF_INSTALL_SOURCE_PERSISTENCE_KEY, signal })).resolves.toEqual(
      success(undefined),
    )
    expect(installSource).toBeUndefined()
  })

  it('rejects invalid keys and values without mutating state', async () => {
    const setInstallSource = vi.fn()
    const persistence = createSelfInstallSourcePersistencePort({
      clearInstallSource: vi.fn(),
      getSelfState: async () => ({}),
      setInstallSource,
    })
    const signal = new AbortController().signal

    await expect(persistence.load({ key: 'agent:codex', signal })).resolves.toMatchObject({
      error: { kind: 'invalid-data' },
      kind: 'failure',
    })
    await expect(
      persistence.save({ key: SELF_INSTALL_SOURCE_PERSISTENCE_KEY, signal, value: 'brew' }),
    ).resolves.toMatchObject({ error: { kind: 'invalid-data' }, kind: 'failure' })
    expect(setInstallSource).not.toHaveBeenCalled()
  })

  it('preserves typed state failures across the persistence boundary', async () => {
    const stateError = new StateFileError('Failed to write Quantex state file.')
    const persistence = createFakePersistencePort({
      save: async () => ({
        error: {
          details: { cause: stateError },
          kind: 'failed',
          message: 'Failed to persist the self install source.',
        },
        kind: 'failure',
      }),
    })

    await expect(
      reconcileSelfInstallSource(undefined, 'npm', {
        persistence,
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(stateError)
  })

  it('rethrows typed state read failures from the production adapter', async () => {
    const stateError = new StateFileError('Failed to read Quantex state file.')
    const persistence = createSelfInstallSourcePersistencePort({
      clearInstallSource: async () => undefined,
      getSelfState: async () => {
        throw stateError
      },
      setInstallSource: async () => undefined,
    })

    await expect(resolveSelfInstallFactsReadOnly({ persistence })).rejects.toBe(stateError)
  })

  it('preserves persistence cancellation as a process interruption', async () => {
    const persistence = createFakePersistencePort({
      save: async () => ({
        error: { kind: 'cancelled', message: 'cancelled persistence' },
        kind: 'failure',
      }),
    })

    await expect(reconcileSelfInstallSource(undefined, 'npm', { persistence })).rejects.toMatchObject({
      kind: 'cancelled',
    })
  })
})

function createFakePersistencePort(overrides: Partial<PersistencePort> = {}): PersistencePort {
  return {
    load: async () => success({ kind: 'missing' }),
    remove: async () => success(undefined),
    save: async () => success({}),
    ...overrides,
  }
}

function success<T>(value: T): RuntimeOutcome<T> {
  return { kind: 'success', value }
}
