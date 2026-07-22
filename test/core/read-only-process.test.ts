import type { ChildProcess, spawn as spawnType } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it, vi } from 'vitest'
import {
  CoreProcessInterruptionError,
  runReadOnlyCommand,
  terminateWindowsTree,
} from '../../src/core/read-only-process'

describe('Core read-only process cleanup', () => {
  it('bounds a stuck Windows taskkill helper before falling back', async () => {
    const killer = new EventEmitter() as ChildProcess
    killer.kill = vi.fn(() => true)
    const spawnProcess = vi.fn(() => killer) as unknown as typeof spawnType

    await expect(terminateWindowsTree(1234, spawnProcess, 5)).resolves.toBe(false)
    expect(killer.kill).toHaveBeenCalledWith('SIGKILL')
  })

  it('terminates an owned process before cancellation rejects', async () => {
    const controller = new AbortController()
    const cleanups: Array<{ cleanup(): Promise<void> | void }> = []
    const result = runReadOnlyCommand([process.execPath, '-e', 'setInterval(() => undefined, 1000)'], {
      registerCleanup(cleanup) {
        cleanups.push(cleanup)
        return () => undefined
      },
      signal: controller.signal,
    })
    await waitFor(() => cleanups.length === 1)
    controller.abort('test-cancel')

    await expect(result).rejects.toBeInstanceOf(CoreProcessInterruptionError)
    await expect(Promise.all(cleanups.map(cleanup => cleanup.cleanup()))).resolves.toBeDefined()
  })

  it.runIf(process.platform === 'win32')(
    'executes and cancels a Windows cmd shim through the real process tree',
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'quantex-core-windows-shim-'))
      try {
        const shim = join(directory, 'fixture.cmd')
        await writeFile(shim, `@echo off\r\n"${process.execPath}" -e "setInterval(() =^> undefined, 1000)"\r\n`)
        const controller = new AbortController()
        const result = runReadOnlyCommand([shim], { signal: controller.signal })
        setTimeout(() => controller.abort('windows-shim-cancel'), 50)
        await expect(result).rejects.toBeInstanceOf(CoreProcessInterruptionError)
      } finally {
        await rm(directory, { force: true, recursive: true })
      }
    },
  )
})

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 1))
  }
  throw new Error('Timed out waiting for the read-only process to register cleanup.')
}
