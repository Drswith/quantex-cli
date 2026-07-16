import type { CommandResult } from '../src/output/types'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { forceTerminateProcessTree, readProcessOutputWithContext, spawnCommand } from '../src/utils/child-process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLI_PATH = join(ROOT, 'src', 'cli.ts')

describe('read-only lifecycle provider timeout', { timeout: 20_000 }, () => {
  it.each([{ timeoutMs: 100 }])(
    'returns TIMEOUT for $timeoutMs ms even when the fixture starts too late to observe',
    async ({ timeoutMs }) => {
      if (process.platform === 'win32') return

      const root = await mkdtemp(join(tmpdir(), 'quantex-readonly-timeout-'))
      const home = join(root, 'home')
      const bin = join(root, 'bin')
      const pidLog = join(root, 'npm-pids.log')
      const fixturePids: number[] = []
      const bun = resolveExecutable('bun')
      await mkdir(join(home, '.quantex'), { recursive: true })
      await mkdir(bin, { recursive: true })
      await writeFile(
        join(home, '.quantex', 'state.json'),
        `${JSON.stringify({
          installedAgents: {
            copilot: {
              agentName: 'copilot',
              binaryName: 'copilot',
              installType: 'npm',
              packageName: '@github/copilot',
              packageTargetKind: 'package',
            },
          },
          lifecycleReceipts: {},
          schemaVersion: 2,
          self: {},
        })}\n`,
      )
      await mkdir(join(home, '.quantex', 'cache'), { recursive: true })
      await writeFile(
        join(home, '.quantex', 'cache', 'versions.json'),
        JSON.stringify({
          entries: {
            'npm:https://registry.npmjs.org:quantex-cli:latest': {
              body: JSON.stringify({ version: '0.29.0' }),
              expiresAt: Date.now() + 60_000,
              fetchedAt: Date.now(),
            },
          },
        }),
      )
      await writeFile(
        join(bin, 'npm'),
        `#!/bin/sh\nprintf 'invoked %s %s\\n' "$$" "$*" >> '${pidLog}'\nsh -c 'trap "" TERM; sleep 30' &\nchild=$!\nprintf '%s %s\\n' "$$" "$child" >> '${pidLog}'\ntrap '' TERM\nwait\n`,
      )
      await chmod(join(bin, 'npm'), 0o755)
      await writeFile(join(bin, 'copilot'), '#!/bin/sh\n[ "$1" = "--version" ] && echo "copilot 1.0.0"\n')
      await chmod(join(bin, 'copilot'), 0o755)

      const startedAt = Date.now()
      const child = spawn(
        bun,
        [CLI_PATH, '--output', 'ndjson', '--non-interactive', '--timeout', `${timeoutMs}ms`, 'info', 'copilot'],
        {
          cwd: ROOT,
          detached: true,
          env: {
            ...process.env,
            HOME: home,
            LANG: 'C',
            LC_ALL: 'C',
            NO_COLOR: '1',
            PATH: `${bin}:/usr/bin:/bin`,
            USERPROFILE: home,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )

      try {
        const [exitCode, stdout, stderr] = await Promise.all([
          waitForExit(child, timeoutMs + 3_000),
          readStream(child.stdout),
          readStream(child.stderr),
        ])
        const timeoutDocument = parseJsonDocuments(stdout).findLast(
          entry => (entry.result ?? entry.data ?? entry).error?.code === 'TIMEOUT',
        )
        const result = timeoutDocument?.result ?? timeoutDocument?.data ?? timeoutDocument
        const pidLogText = await readFile(pidLog, 'utf8').catch(() => '<missing>')
        expect(result, `stdout=${stdout}\nstderr=${stderr}\npidLog=${pidLogText}`).toMatchObject({
          error: { code: 'TIMEOUT', details: { timeoutMs } },
          ok: false,
        })
        expect(exitCode).toBe(10)
        expect(Date.now() - startedAt).toBeLessThan(3_000)
      } finally {
        if (child.pid && isProcessAlive(child.pid)) process.kill(-child.pid, 'SIGKILL')
        if (existsSync(pidLog)) fixturePids.push(...(await readShellFixturePids(pidLog)))
        await killFixtureProcesses(fixturePids)
        await rm(root, { force: true, recursive: true })
      }
    },
    10_000,
  )

  it('terminates a hanging npm probe process tree at a 100ms provider deadline', async () => {
    if (process.platform === 'win32') return
    const root = await mkdtemp(join(tmpdir(), 'quantex-provider-tree-'))
    const npm = join(root, 'npm')
    const pidLog = join(root, 'pids.log')
    const fixturePids: number[] = []
    await writeFile(
      npm,
      `#!${resolveExecutable('bun')}\nsetTimeout(() => process.exit(124), 15_000)\nprocess.on('SIGTERM', () => undefined)\nconst child = Bun.spawn([process.execPath, '-e', "process.on('SIGTERM', () => undefined); await Bun.sleep(15_000)"], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })\nawait Bun.write(${JSON.stringify(pidLog)}, \`\${process.pid} \${child.pid}\\n\`)\nawait child.exited\n`,
    )
    await chmod(npm, 0o755)
    const proc = spawnCommand([npm, 'list', '-g', '@github/copilot', '--depth=0', '--json'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    try {
      await waitForFile(pidLog, 10_000)
      await expect(
        readProcessOutputWithContext(proc, {
          signal: new AbortController().signal,
          timeoutMs: 100,
        }),
      ).rejects.toMatchObject({ kind: 'timed-out', timeoutMs: 100 })
      fixturePids.push(...(await readPids(pidLog)))
      expect(fixturePids.length).toBe(2)
      await waitForProcessesStopped(fixturePids, 1_000)
      expect(fixturePids.filter(isProcessAlive)).toEqual([])
    } finally {
      await forceTerminateProcessTree(proc)
      if (fixturePids.length === 0 && existsSync(pidLog)) fixturePids.push(...(await readPids(pidLog)))
      await killFixtureProcesses(fixturePids)
      await rm(root, { force: true, recursive: true })
    }
  }, 20_000)
})

function resolveExecutable(name: string): string {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const path = join(directory, name)
    if (existsSync(path)) return path
  }
  throw new Error(`Unable to find ${name}.`)
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

async function waitForProcessesStopped(pids: number[], timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (pids.some(isProcessAlive) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5))
}

async function waitForFile(path: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(path)) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error(`Timed out waiting for ${path}.`)
}

async function readPids(path: string): Promise<number[]> {
  return (await readFile(path, 'utf8')).trim().split(/\s+/).map(Number).filter(Number.isFinite)
}

async function readShellFixturePids(path: string): Promise<number[]> {
  return (await readFile(path, 'utf8')).split('\n').flatMap(line => {
    const match = /^(\d+) (\d+)$/.exec(line.trim())
    return match ? [Number(match[1]), Number(match[2])] : []
  })
}

async function killFixtureProcesses(pids: number[]): Promise<void> {
  for (const pid of new Set(pids)) {
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      // Only process-group leaders have a matching negative PID.
    }
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // The fixture may already have exited through the production cleanup path.
    }
  }
  await waitForProcessesStopped(pids, 1_000)
}

interface JsonDocument extends Partial<CommandResult> {
  data?: CommandResult
  result?: CommandResult
  type?: string
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
