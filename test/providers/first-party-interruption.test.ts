import type { ProviderId, ProviderTarget } from '../../src/providers'
import { existsSync } from 'node:fs'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
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

afterEach(async () => {
  process.env.PATH = originalPath
  await Promise.all(roots.splice(0).map(root => rm(root, { force: true, recursive: true })))
}, 15_000)

describe('first-party provider interruption', () => {
  it('preserves typed timeouts and joins all availability process trees', async () => {
    const fixture = await createProviderFixtures(
      availabilityProviders.map(([id, executable]) => ({ executable, id, mode: 'hang' as const })),
    )

    const outcomes = await Promise.all(
      availabilityProviders.map(([id]) =>
        firstPartyProviderRegistry.get(id)!.availability({
          signal: new AbortController().signal,
          timeoutMs: 10_000,
        }),
      ),
    )

    expect(outcomes).toEqual(availabilityProviders.map(() => ({ kind: 'timed-out', timeoutMs: 10_000 })))
    await expectAllTreesStopped(fixture)
  }, 30_000)

  it('preserves typed cancellation and joins all availability process trees', async () => {
    const fixture = await createProviderFixtures(
      availabilityProviders.map(([id, executable]) => ({ executable, id, mode: 'hang' as const })),
    )
    const controllers = availabilityProviders.map(() => new AbortController())
    const pending = availabilityProviders.map(([id], index) =>
      firstPartyProviderRegistry.get(id)!.availability({ signal: controllers[index]!.signal }),
    )
    await fixture.waitForAllTrees()
    controllers.forEach(controller => controller.abort('test cancellation'))

    expect(await Promise.all(pending)).toEqual(
      availabilityProviders.map(() => ({ kind: 'cancelled', reason: 'test cancellation' })),
    )
    await expectAllTreesStopped(fixture)
  }, 15_000)

  it('kills descendants that outlive a process-group leader after cancellation', async () => {
    const fixture = await createProviderFixtures([{ executable: 'bun', id: 'bun', mode: 'parent-exits-child-hangs' }])
    const controller = new AbortController()
    const pending = firstPartyProviderRegistry.get('bun')!.availability({ signal: controller.signal })
    await fixture.waitForAllTrees()
    controller.abort('test cancellation')

    await expect(pending).resolves.toEqual({ kind: 'cancelled', reason: 'test cancellation' })
    await expectAllTreesStopped(fixture)
  }, 15_000)

  it('preserves typed timeouts through npm, Bun, mise, and uv presence/version probes', async () => {
    const fixture = await createProviderFixtures(
      observationProviders.map(([id, executable, firstOutput]) => ({
        executable,
        firstOutput,
        id,
        mode: 'version-then-hang' as const,
      })),
    )
    const target: ProviderTarget = { id: 'demo', kind: 'package' }

    const outcomes = await Promise.all(
      observationProviders.map(([id]) =>
        firstPartyProviderRegistry.get(id)!.observe!({
          context: { signal: new AbortController().signal, timeoutMs: 10_000 },
          target: id === 'mise' || id === 'uv' ? { ...target, kind: 'tool' } : target,
        }),
      ),
    )

    expect(outcomes).toEqual(observationProviders.map(() => ({ kind: 'timed-out', timeoutMs: 10_000 })))
    await expectAllTreesStopped(fixture)
  }, 30_000)

  it('preserves typed cancellation through npm, Bun, mise, and uv presence/version probes', async () => {
    const fixture = await createProviderFixtures(
      observationProviders.map(([id, executable, firstOutput]) => ({
        executable,
        firstOutput,
        id,
        mode: 'version-then-hang' as const,
      })),
    )
    const controllers = observationProviders.map(() => new AbortController())
    const target: ProviderTarget = { id: 'demo', kind: 'package' }
    const pending = observationProviders.map(([id], index) =>
      firstPartyProviderRegistry.get(id)!.observe!({
        context: { signal: controllers[index]!.signal },
        target: id === 'mise' || id === 'uv' ? { ...target, kind: 'tool' } : target,
      }),
    )
    await fixture.waitForAllTrees()
    controllers.forEach(controller => controller.abort('test cancellation'))

    expect(await Promise.all(pending)).toEqual(
      observationProviders.map(() => ({ kind: 'cancelled', reason: 'test cancellation' })),
    )
    await expectAllTreesStopped(fixture)
  }, 20_000)
})

interface FixtureInput {
  executable: string
  firstOutput?: string
  id: ProviderId
  mode: 'hang' | 'parent-exits-child-hangs' | 'version-then-hang'
}

async function createProviderFixtures(inputs: FixtureInput[]) {
  const root = await mkdtemp(join(tmpdir(), 'quantex-first-party-interruption-'))
  roots.push(root)
  const bun = resolveExecutable('bun')
  const pidLogs: string[] = []

  for (const input of inputs) {
    const pidLog = join(root, `${input.id}.pids`)
    const countFile = join(root, `${input.id}.count`)
    pidLogs.push(pidLog)
    await writeFile(
      join(root, input.executable),
      `#!${bun}\nconst mode = ${JSON.stringify(input.mode)}\nconst countFile = ${JSON.stringify(countFile)}\nlet count = 0\ntry { count = Number(await Bun.file(countFile).text()) } catch {}\nawait Bun.write(countFile, String(count + 1))\nif (mode === 'version-then-hang' && count === 0) { console.log(${JSON.stringify(input.firstOutput ?? '')}); process.exit(0) }\nprocess.on('SIGTERM', () => { if (mode === 'parent-exits-child-hangs') process.exit(0) })\nprocess.on('SIGINT', () => undefined)\nconst child = Bun.spawn([process.execPath, '-e', "process.on('SIGTERM', () => undefined); process.on('SIGINT', () => undefined); await new Promise(() => undefined)"], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })\nawait Bun.write(${JSON.stringify(pidLog)}, \`\${process.pid} \${child.pid}\\n\`)\nawait child.exited\n`,
    )
    await chmod(join(root, input.executable), 0o755)
  }

  process.env.PATH = `${root}${delimiter}${originalPath ?? ''}`
  return {
    pidLogs,
    waitForAllTrees: () => waitForFiles(pidLogs, 10_000),
  }
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

function resolveExecutable(name: string): string {
  for (const directory of (originalPath ?? '').split(delimiter)) {
    const candidate = join(directory, name)
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`Unable to find ${name}.`)
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
