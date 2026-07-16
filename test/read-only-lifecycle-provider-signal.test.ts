import type { CommandResult } from '../src/output/types'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLI_PATH = join(ROOT, 'src', 'cli.ts')

describe('read-only lifecycle mixed signal cancellation', () => {
  it.each(['SIGINT', 'SIGTERM'] as const)(
    'cancels %s and terminates provider and agent process trees',
    async signal => {
      if (process.platform === 'win32') return
      const root = await mkdtemp(join(tmpdir(), 'quantex-readonly-signal-'))
      const home = join(root, 'home')
      const bin = join(root, 'bin')
      const providerPidLog = join(root, 'provider.pids.log')
      const agentPidLog = join(root, 'agent.pids.log')
      const fixturePids: number[] = []
      const bun = resolveExecutable('bun')
      await mkdir(join(home, '.quantex'), { recursive: true })
      await mkdir(bin, { recursive: true })
      await writeFile(
        join(home, '.quantex', 'state.json'),
        `${JSON.stringify({ installedAgents: {}, lifecycleReceipts: {}, schemaVersion: 2, self: {} })}\n`,
      )
      await writeFile(join(bin, 'npm'), hangingTreeScript(bun, providerPidLog))
      await chmod(join(bin, 'npm'), 0o755)
      await writeFile(join(bin, 'codex'), hangingTreeScript(bun, agentPidLog))
      await chmod(join(bin, 'codex'), 0o755)
      const child = spawn(bun, [CLI_PATH, '--output', 'ndjson', '--non-interactive', 'doctor'], {
        cwd: ROOT,
        env: {
          ...process.env,
          HOME: home,
          NO_COLOR: '1',
          PATH: `${bin}:/usr/bin:/bin`,
          USERPROFILE: home,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      try {
        await Promise.all([waitForFile(providerPidLog, 10_000), waitForFile(agentPidLog, 10_000)])
        fixturePids.push(...(await readPids(providerPidLog)), ...(await readPids(agentPidLog)))
        expect(fixturePids.length).toBe(4)
        const startedAt = Date.now()
        child.kill(signal)
        const [exitCode, stdout, stderr] = await Promise.all([
          waitForExit(child, 3_000),
          readStream(child.stdout),
          readStream(child.stderr),
        ])
        const result = parseJsonDocuments(`${stdout}\n${stderr}`).findLast(
          entry => (entry.data ?? entry).error?.code === 'CANCELLED',
        )

        expect(exitCode).toBe(11)
        expect(result?.data ?? result).toMatchObject({ error: { code: 'CANCELLED', details: { signal } }, ok: false })
        await waitForProcessesStopped(fixturePids, 1_000)
        expect(Date.now() - startedAt).toBeLessThan(3_000)
        expect(fixturePids.filter(isProcessAlive)).toEqual([])
      } finally {
        await killFixtureProcesses(fixturePids)
        if (child.pid && isProcessAlive(child.pid)) child.kill('SIGKILL')
        await rm(root, { force: true, recursive: true })
      }
    },
    20_000,
  )
})

function hangingTreeScript(bun: string, pidLog: string): string {
  return `#!${bun}\nprocess.on('SIGTERM', () => undefined)\nprocess.on('SIGINT', () => undefined)\nconst child = Bun.spawn([process.execPath, '-e', "process.on('SIGTERM', () => undefined); process.on('SIGINT', () => undefined); await new Promise(() => undefined)"], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })\nawait Bun.write(${JSON.stringify(pidLog)}, \`\${process.pid} \${child.pid}\\n\`)\nawait child.exited\n`
}

function resolveExecutable(name: string): string {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(directory, name)
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`Unable to find ${name}.`)
}

async function waitForFile(path: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!existsSync(path) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5))
  if (!existsSync(path)) throw new Error(`Timed out waiting for ${path}.`)
}

async function readPids(path: string): Promise<number[]> {
  return (await readFile(path, 'utf8')).trim().split(/\s+/).map(Number).filter(Number.isFinite)
}

async function waitForProcessesStopped(pids: number[], timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (pids.some(isProcessAlive) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5))
}

async function killFixtureProcesses(pids: number[]): Promise<void> {
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

function waitForExit(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`CLI did not exit within ${timeoutMs}ms.`)), timeoutMs)
    child.once('error', reject)
    child.once('close', code => {
      clearTimeout(timeout)
      resolve(code ?? 1)
    })
  })
}

async function readStream(stream: NodeJS.ReadableStream | null): Promise<string> {
  if (!stream) return ''
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

interface JsonDocument extends Partial<CommandResult> {
  data?: CommandResult
}

function parseJsonDocuments(stdout: string): JsonDocument[] {
  const documents: JsonDocument[] = []
  let depth = 0
  let start = -1
  let escaped = false
  let quoted = false
  for (let index = 0; index < stdout.length; index += 1) {
    const character = stdout[index]!
    if (quoted) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quoted = false
      continue
    }
    if (character === '"') quoted = true
    else if (character === '{') {
      if (depth === 0) start = index
      depth += 1
    } else if (character === '}') {
      depth -= 1
      if (depth === 0 && start >= 0) documents.push(JSON.parse(stdout.slice(start, index + 1)))
    }
  }
  return documents
}
