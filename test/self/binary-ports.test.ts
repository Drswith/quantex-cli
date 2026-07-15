import type { NetworkPort, ProcessPort } from '../../src/runtime'
import { createHash } from 'node:crypto'
import { access, chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { upgradeStandaloneBinary } from '../../src/self/binary'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

describe.skipIf(process.platform === 'win32')('standalone binary runtime ports', () => {
  it('downloads and verifies through shared ports while preserving atomic replacement', async () => {
    const directory = await createDirectory()
    const executablePath = join(directory, 'qtx')
    const nextBinary = new TextEncoder().encode('new binary')
    await writeFile(executablePath, 'old binary')
    await chmod(executablePath, 0o755)
    const networkPort = createNetworkPort(nextBinary)
    const run = vi.fn(async () => ({
      kind: 'success' as const,
      value: { exitCode: 0, stdout: new TextEncoder().encode('quantex 1.2.3\n') },
    }))

    await expect(
      upgradeStandaloneBinary(
        'https://releases.example/qtx',
        executablePath,
        checksum(nextBinary),
        '1.2.3',
        undefined,
        {
          networkPort,
          processPort: { run },
          signal: new AbortController().signal,
          timeoutMs: 2_000,
        },
      ),
    ).resolves.toEqual({ success: true })
    expect(await readFile(executablePath, 'utf8')).toBe('new binary')
    await expect(access(`${executablePath}.bak`)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(run).toHaveBeenCalledWith({
      argv: [executablePath, '--version'],
      signal: expect.any(AbortSignal),
      stdio: ['ignore', 'pipe', 'ignore'],
      timeoutMs: 2_000,
    })
  })

  it('restores the original binary when port-driven verification fails', async () => {
    const directory = await createDirectory()
    const executablePath = join(directory, 'qtx')
    const nextBinary = new TextEncoder().encode('new binary')
    await writeFile(executablePath, 'old binary')
    await chmod(executablePath, 0o755)
    const processPort: ProcessPort = {
      run: async () => ({
        kind: 'success',
        value: { exitCode: 0, stdout: new TextEncoder().encode('quantex 9.9.9\n') },
      }),
    }

    await expect(
      upgradeStandaloneBinary(
        'https://releases.example/qtx',
        executablePath,
        checksum(nextBinary),
        '1.2.3',
        undefined,
        {
          networkPort: createNetworkPort(nextBinary),
          processPort,
          signal: new AbortController().signal,
        },
      ),
    ).resolves.toMatchObject({ error: { kind: 'verify' }, success: false })
    expect(await readFile(executablePath, 'utf8')).toBe('old binary')
  })

  it('preserves cancellation from the network port before filesystem mutation', async () => {
    const directory = await createDirectory()
    const executablePath = join(directory, 'qtx')
    await writeFile(executablePath, 'old binary')
    const networkPort: NetworkPort = {
      request: async () => ({
        error: { kind: 'cancelled', message: 'cancelled by caller' },
        kind: 'failure',
      }),
    }

    await expect(
      upgradeStandaloneBinary('https://releases.example/qtx', executablePath, 'unused', '1.2.3', undefined, {
        networkPort,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ kind: 'cancelled' })
    expect(await readFile(executablePath, 'utf8')).toBe('old binary')
  })

  it('restores the original binary and preserves verification timeout', async () => {
    const directory = await createDirectory()
    const executablePath = join(directory, 'qtx')
    const nextBinary = new TextEncoder().encode('new binary')
    await writeFile(executablePath, 'old binary')
    await chmod(executablePath, 0o755)
    const processPort: ProcessPort = {
      run: async () => ({
        error: { kind: 'timed-out', message: 'verification timed out' },
        kind: 'failure',
      }),
    }

    await expect(
      upgradeStandaloneBinary(
        'https://releases.example/qtx',
        executablePath,
        checksum(nextBinary),
        '1.2.3',
        undefined,
        {
          networkPort: createNetworkPort(nextBinary),
          processPort,
          signal: new AbortController().signal,
          timeoutMs: 750,
        },
      ),
    ).rejects.toMatchObject({ kind: 'timed-out', timeoutMs: 750 })
    expect(await readFile(executablePath, 'utf8')).toBe('old binary')
  })
})

function createNetworkPort(body: Uint8Array): NetworkPort {
  return {
    request: async () => ({ kind: 'success', value: { body, headers: {}, status: 200 } }),
  }
}

async function createDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'qtx-binary-ports-'))
  directories.push(directory)
  return directory
}

function checksum(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}
