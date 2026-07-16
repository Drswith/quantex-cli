import type { ProviderId, ProviderTarget } from '../../src/providers'
import { existsSync } from 'node:fs'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveExecutableFromPath } from '../../scripts/resolve-executable'
import { firstPartyProviderRegistry } from '../../src/providers'

const availabilityProviders = [
  ['brew', 'brew'],
  ['bun', 'bun'],
  ['cargo', 'cargo'],
  ['deno', 'deno'],
  ['mise', 'mise'],
  ['npm', 'npm'],
  ['pip', 'pip'],
  ['uv', 'uv'],
  ['winget', 'winget'],
] as const satisfies readonly (readonly [ProviderId, string])[]

const observationProviders = [
  ['bun', 'bun', 'demo@1.0.0'],
  ['mise', 'mise', '{"demo":[{"version":"1.0.0"}]}'],
  ['npm', 'npm', '{"dependencies":{"demo":{"version":"1.0.0"}}}'],
  ['uv', 'uv', 'demo v1.0.0'],
] as const satisfies readonly (readonly [ProviderId, string, string])[]

const roots: string[] = []
const originalPath = process.env.PATH
const providerTimeoutMs = 10_000

afterEach(async () => {
  process.env.PATH = originalPath
  await Promise.all(roots.splice(0).map(root => rm(root, { force: true, recursive: true })))
}, 15_000)

describe('first-party provider interruption', () => {
  it('preserves typed timeouts and joins every availability process tree', async () => {
    for (const [id, executable] of availabilityProviders)
      await withProviderFixtures([{ executable, id, mode: 'hang' }], async fixture => {
        const pending = firstPartyProviderRegistry.get(id)!.availability({
          signal: new AbortController().signal,
          timeoutMs: providerTimeoutMs,
        })
        await fixture.waitForAllTrees()
        await expect(pending).resolves.toEqual({ kind: 'timed-out', timeoutMs: providerTimeoutMs })
        await expectAllTreesStopped(fixture)
      })
  }, 120_000)

  it('preserves typed cancellation and joins every availability process tree', async () => {
    for (const [id, executable] of availabilityProviders)
      await withProviderFixtures([{ executable, id, mode: 'hang' }], async fixture => {
        const controller = new AbortController()
        const pending = firstPartyProviderRegistry.get(id)!.availability({ signal: controller.signal })
        await fixture.waitForAllTrees()
        controller.abort('test cancellation')

        await expect(pending).resolves.toEqual({ kind: 'cancelled', reason: 'test cancellation' })
        await expectAllTreesStopped(fixture)
      })
  }, 45_000)

  it.skipIf(process.platform === 'win32')(
    'kills descendants that outlive a process-group leader after cancellation',
    async () => {
      await withProviderFixtures(
        [{ executable: 'bun', id: 'bun', mode: 'parent-exits-child-hangs' }],
        async fixture => {
          const controller = new AbortController()
          const pending = firstPartyProviderRegistry.get('bun')!.availability({ signal: controller.signal })
          await fixture.waitForAllTrees()
          controller.abort('test cancellation')

          await expect(pending).resolves.toEqual({ kind: 'cancelled', reason: 'test cancellation' })
          await expectAllTreesStopped(fixture)
        },
      )
    },
    15_000,
  )

  it('preserves typed timeouts through npm, Bun, mise, and uv presence/version probes', async () => {
    const target: ProviderTarget = { id: 'demo', kind: 'package' }
    for (const [id, executable, firstOutput] of observationProviders)
      await withProviderFixtures([{ executable, firstOutput, id, mode: 'version-then-hang' }], async fixture => {
        const pending = firstPartyProviderRegistry.get(id)!.observe!({
          context: { signal: new AbortController().signal, timeoutMs: providerTimeoutMs },
          target: id === 'mise' || id === 'uv' ? { ...target, kind: 'tool' } : target,
        })
        await fixture.waitForAllTrees()
        await expect(pending).resolves.toEqual({ kind: 'timed-out', timeoutMs: providerTimeoutMs })
        await expectAllTreesStopped(fixture)
      })
  }, 60_000)

  it('preserves typed cancellation through npm, Bun, mise, and uv presence/version probes', async () => {
    const target: ProviderTarget = { id: 'demo', kind: 'package' }
    for (const [id, executable, firstOutput] of observationProviders)
      await withProviderFixtures([{ executable, firstOutput, id, mode: 'version-then-hang' }], async fixture => {
        const controller = new AbortController()
        const pending = firstPartyProviderRegistry.get(id)!.observe!({
          context: { signal: controller.signal },
          target: id === 'mise' || id === 'uv' ? { ...target, kind: 'tool' } : target,
        })
        await fixture.waitForAllTrees()
        controller.abort('test cancellation')

        await expect(pending).resolves.toEqual({ kind: 'cancelled', reason: 'test cancellation' })
        await expectAllTreesStopped(fixture)
      })
  }, 30_000)
})

interface FixtureInput {
  executable: string
  firstOutput?: string
  id: ProviderId
  mode: 'hang' | 'parent-exits-child-hangs' | 'version-then-hang'
}

interface ProviderFixture {
  pidLogs: string[]
  waitForAllTrees: () => Promise<void>
}

async function withProviderFixtures<T>(inputs: FixtureInput[], run: (fixture: ProviderFixture) => Promise<T>) {
  const fixture = await createProviderFixtures(inputs)
  try {
    return await run(fixture)
  } finally {
    await killFixtureProcesses(fixture)
  }
}

async function createProviderFixtures(inputs: FixtureInput[]) {
  const root = await mkdtemp(join(tmpdir(), 'quantex-first-party-interruption-'))
  roots.push(root)
  const bun = resolveExecutableFromPath('bun', { path: originalPath ?? '' })
  const pidLogs: string[] = []

  for (const input of inputs) {
    const pidLog = join(root, `${input.id}.pids`)
    const countFile = join(root, `${input.id}.count`)
    const executablePath = join(root, process.platform === 'win32' ? `${input.executable}.cmd` : input.executable)
    const scriptPath = process.platform === 'win32' ? join(root, `${input.id}.fixture.ts`) : executablePath
    pidLogs.push(pidLog)
    await writeFile(
      scriptPath,
      `${process.platform === 'win32' ? '' : `#!${bun}\n`}const mode = ${JSON.stringify(input.mode)}\nconst countFile = ${JSON.stringify(countFile)}\nlet count = 0\ntry { count = Number(await Bun.file(countFile).text()) } catch {}\nawait Bun.write(countFile, String(count + 1))\nif (mode === 'version-then-hang' && count === 0) { console.log(${JSON.stringify(input.firstOutput ?? '')}); process.exit(0) }\nsetTimeout(() => process.exit(124), 15_000)\nprocess.on('SIGTERM', () => { if (mode === 'parent-exits-child-hangs') process.exit(0) })\nprocess.on('SIGINT', () => undefined)\nconst child = Bun.spawn([process.execPath, '-e', "process.on('SIGTERM', () => undefined); process.on('SIGINT', () => undefined); await Bun.sleep(15_000)"], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })\nawait Bun.write(${JSON.stringify(pidLog)}, \`\${process.pid} \${child.pid}\\n\`)\nawait child.exited\n`,
    )
    if (process.platform === 'win32') await writeFile(executablePath, `@"${bun}" "${scriptPath}" %*\r\n`)
    else await chmod(executablePath, 0o755)
  }

  process.env.PATH = `${root}${delimiter}${originalPath ?? ''}`
  return {
    pidLogs,
    waitForAllTrees: () => waitForFiles(pidLogs, 10_000),
  }
}

async function killFixtureProcesses(fixture: ProviderFixture): Promise<void> {
  const existingLogs = fixture.pidLogs.filter(existsSync)
  const pids = (await Promise.all(existingLogs.map(readPids))).flat()
  for (const pid of new Set(pids)) {
    if (!isProcessAlive(pid)) continue
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // The fixture process may have exited between the liveness check and kill.
    }
  }
  await waitForProcessesStopped(pids, 1_000)
}

async function expectAllTreesStopped(fixture: { pidLogs: string[] }): Promise<void> {
  await waitForFiles(fixture.pidLogs, 10_000)
  const pids = (await Promise.all(fixture.pidLogs.map(readPids))).flat()
  expect(pids.length).toBe(fixture.pidLogs.length * 2)
  await waitForProcessesStopped(pids, 1_000)
  expect(pids.filter(isProcessAlive)).toEqual([])
}

async function waitForProcessesStopped(pids: number[], timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (pids.some(isProcessAlive) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5))
}

async function waitForFiles(paths: string[], timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (paths.some(path => !existsSync(path)) && Date.now() < deadline)
    await new Promise(resolve => setTimeout(resolve, 5))
  const missing = paths.filter(path => !existsSync(path))
  if (missing.length > 0) throw new Error(`Provider processes did not start: ${missing.join(', ')}`)
}

async function readPids(path: string): Promise<number[]> {
  return (await readFile(path, 'utf8')).trim().split(/\s+/).map(Number).filter(Number.isFinite)
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
