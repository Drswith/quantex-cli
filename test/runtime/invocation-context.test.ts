import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  type CacheLookup,
  type CacheReadRequest,
  type CacheWriteRequest,
  type ClockSleepRequest,
  createInvocationContext,
  type DirectoryCreateRequest,
  type FileReadRequest,
  type FileRemoveRequest,
  type FileRenameRequest,
  type FileWriteRequest,
  type LockAcquireRequest,
  type NetworkRequest,
  type NetworkResponse,
  type PersistenceLookup,
  type PersistenceReadRequest,
  type PersistenceWriteRequest,
  type PersistenceWriteResult,
  type ProcessRequest,
  type ProcessResult,
  type RuntimeOutcome,
  type RuntimePorts,
} from '../../src/runtime'

describe('createInvocationContext', () => {
  it('isolates options and runtime ports between concurrent invocations', () => {
    const firstPorts = createFakePorts()
    const secondPorts = createFakePorts()
    const firstInput: {
      cacheMode: 'no-cache'
      dryRun: boolean
      outputMode: 'json'
      ports: RuntimePorts
      quiet: boolean
      timeoutMs: number
    } = {
      cacheMode: 'no-cache',
      dryRun: true,
      outputMode: 'json',
      ports: firstPorts,
      quiet: false,
      timeoutMs: 1_000,
    }

    const first = createInvocationContext(firstInput)
    const second = createInvocationContext({
      cacheMode: 'refresh',
      dryRun: false,
      outputMode: 'ndjson',
      ports: secondPorts,
      quiet: true,
      timeoutMs: 2_000,
    })

    expect(first.options).toEqual({
      cacheMode: 'no-cache',
      dryRun: true,
      outputMode: 'json',
      quiet: false,
      timeoutMs: 1_000,
    })
    expect(second.options).toEqual({
      cacheMode: 'refresh',
      dryRun: false,
      outputMode: 'ndjson',
      quiet: true,
      timeoutMs: 2_000,
    })
    expect(first.options).not.toBe(second.options)
    expect(first.ports).not.toBe(firstPorts)
    expect(second.ports).not.toBe(secondPorts)
    expect(first.ports).not.toBe(second.ports)
    expect(first.ports.cache).toBe(firstPorts.cache)
    expect(second.ports.cache).toBe(secondPorts.cache)
    expect(first.ports.cache).not.toBe(second.ports.cache)
    expect(Object.isFrozen(first.options)).toBe(true)
    expect(Object.isFrozen(first.ports)).toBe(true)

    firstInput.dryRun = false
    firstInput.ports = secondPorts

    expect(first.options.dryRun).toBe(true)
    expect(first.ports.cache).toBe(firstPorts.cache)
  })

  it('isolates cancellation state and handlers between concurrent invocations', async () => {
    const first = createInvocationContext({ ports: createFakePorts() })
    const second = createInvocationContext({ ports: createFakePorts() })
    const firstHandler = vi.fn(async () => {})
    const secondHandler = vi.fn(async () => {})

    first.onCancel(firstHandler)
    second.onCancel(secondHandler)

    await first.cancel('test')
    await first.cancel('ignored-repeat')

    expect(first.signal.aborted).toBe(true)
    expect(first.signal.reason).toBe('test')
    expect(second.signal.aborted).toBe(false)
    expect(firstHandler).toHaveBeenCalledOnce()
    expect(secondHandler).not.toHaveBeenCalled()

    await second.cancel('second')

    expect(second.signal.aborted).toBe(true)
    expect(second.signal.reason).toBe('second')
    expect(secondHandler).toHaveBeenCalledOnce()
  })

  it('uses isolated defaults and lets callers unregister cancellation handlers', async () => {
    const first = createInvocationContext({ ports: createFakePorts() })
    const second = createInvocationContext({ ports: createFakePorts() })
    const removedHandler = vi.fn()
    const unregister = first.onCancel(removedHandler)

    unregister()
    await first.cancel()

    expect(first.options).toEqual({
      cacheMode: 'default',
      dryRun: false,
      outputMode: 'human',
      quiet: false,
      timeoutMs: undefined,
    })
    expect(second.options).toEqual(first.options)
    expect(second.options).not.toBe(first.options)
    expect(second.signal.aborted).toBe(false)
    expect(removedHandler).not.toHaveBeenCalled()
  })

  it('waits for handlers when abort listeners re-enter cancellation', async () => {
    const context = createInvocationContext({ ports: createFakePorts() })
    const handlerStarted = createDeferred()
    const releaseHandler = createDeferred()
    const handler = vi.fn(async () => {
      handlerStarted.resolve()
      await releaseHandler.promise
    })
    let reentrantCancellation: Promise<void> | undefined

    context.onCancel(handler)
    context.signal.addEventListener('abort', () => {
      reentrantCancellation = context.cancel('reentrant')
    })

    const cancellation = context.cancel('outer')
    await handlerStarted.promise
    let cancellationFinished = false
    void cancellation.then(() => {
      cancellationFinished = true
      return undefined
    })
    await Promise.resolve()
    const finishedBeforeHandler = cancellationFinished
    const sharedCancellation = reentrantCancellation === cancellation

    releaseHandler.resolve()
    await Promise.all([cancellation, reentrantCancellation])

    expect(finishedBeforeHandler).toBe(false)
    expect(sharedCancellation).toBe(true)
    expect(context.signal.reason).toBe('outer')
    expect(handler).toHaveBeenCalledOnce()
  })

  it('types cache and persistence read values as unknown', () => {
    type CacheValue = Extract<CacheLookup, { readonly kind: 'hit' }>['value']
    type PersistenceValue = Extract<PersistenceLookup, { readonly kind: 'found' }>['snapshot']['value']

    expectTypeOf<CacheValue>().toEqualTypeOf<unknown>()
    expectTypeOf<PersistenceValue>().toEqualTypeOf<unknown>()
  })

  it('releases an acquired lock after invocation cancellation aborts the signal', async () => {
    let context!: ReturnType<typeof createInvocationContext>
    let releaseCompleted = false
    const release = vi.fn(async (): Promise<RuntimeOutcome<void>> => {
      expect(context.signal.aborted).toBe(true)
      await Promise.resolve()
      releaseCompleted = true
      return success(undefined)
    })
    const ports = createFakePorts(release)
    context = createInvocationContext({ ports })
    const acquisition = await context.ports.locks.acquire({
      resource: 'agent:codex',
      scope: ['agent', 'codex'],
      signal: context.signal,
    })

    expect(acquisition.kind).toBe('success')
    if (acquisition.kind === 'failure') throw new Error(acquisition.error.message)

    context.onCancel(async () => {
      await acquisition.value.release()
    })
    await context.cancel('cancel-lock-holder')

    expect(release).toHaveBeenCalledOnce()
    expect(releaseCompleted).toBe(true)
  })
})

type ReleaseLock = () => Promise<RuntimeOutcome<void>>

function createFakePorts(release: ReleaseLock = async () => success(undefined)): RuntimePorts {
  const ports = {
    cache: {
      async read(_request: CacheReadRequest): Promise<RuntimeOutcome<CacheLookup>> {
        return success({ kind: 'miss' })
      },
      async remove(_request: CacheReadRequest): Promise<RuntimeOutcome<void>> {
        return success(undefined)
      },
      async write(_request: CacheWriteRequest): Promise<RuntimeOutcome<void>> {
        return success(undefined)
      },
    },
    clock: {
      now: () => 0,
      async sleep(_request: ClockSleepRequest): Promise<RuntimeOutcome<void>> {
        return success(undefined)
      },
    },
    fileSystem: {
      async makeDirectory(_request: DirectoryCreateRequest): Promise<RuntimeOutcome<void>> {
        return success(undefined)
      },
      async readFile(_request: FileReadRequest): Promise<RuntimeOutcome<Uint8Array>> {
        return success(new Uint8Array())
      },
      async remove(_request: FileRemoveRequest): Promise<RuntimeOutcome<void>> {
        return success(undefined)
      },
      async rename(_request: FileRenameRequest): Promise<RuntimeOutcome<void>> {
        return success(undefined)
      },
      async writeFile(_request: FileWriteRequest): Promise<RuntimeOutcome<void>> {
        return success(undefined)
      },
    },
    locks: {
      async acquire(_request: LockAcquireRequest) {
        return success({ release })
      },
    },
    network: {
      async request(_request: NetworkRequest): Promise<RuntimeOutcome<NetworkResponse>> {
        return success({ body: new Uint8Array(), headers: {}, status: 200 })
      },
    },
    persistence: {
      async load(_request: PersistenceReadRequest): Promise<RuntimeOutcome<PersistenceLookup>> {
        return success({ kind: 'missing' })
      },
      async remove(_request: PersistenceReadRequest): Promise<RuntimeOutcome<void>> {
        return success(undefined)
      },
      async save(_request: PersistenceWriteRequest): Promise<RuntimeOutcome<PersistenceWriteResult>> {
        return success({})
      },
    },
    process: {
      async run(_request: ProcessRequest): Promise<RuntimeOutcome<ProcessResult>> {
        return success({ exitCode: 0 })
      },
    },
  } satisfies RuntimePorts

  return ports
}

function success<T>(value: T): RuntimeOutcome<T> {
  return { kind: 'success', value }
}

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>(complete => {
    resolve = complete
  })

  return { promise, resolve }
}
