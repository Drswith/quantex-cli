import type { CommandResult } from '../src/output/types'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, relative } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveExecutableFromPath } from '../scripts/resolve-executable'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLI_PATH = join(ROOT, 'src', 'cli.ts')

describe('read-only network request timeout', () => {
  it('returns the established TIMEOUT envelope when transport rejects on abort before headers', async () => {
    const root = await mkdtemp(join(tmpdir(), 'quantex-header-timeout-'))
    const home = join(root, 'home')
    const configDir = join(home, '.quantex')
    const preload = join(root, 'headerless-fetch.mjs')
    const bun = resolveExecutableFromPath('bun')
    await mkdir(configDir, { recursive: true })
    await writeFile(
      join(configDir, 'state.json'),
      `${JSON.stringify({ installedAgents: {}, lifecycleReceipts: {}, schemaVersion: 2, self: {} })}\n`,
    )
    await writeFile(
      preload,
      `globalThis.fetch = (_input, init = {}) => new Promise((_resolve, reject) => { init.signal?.addEventListener('abort', () => reject(new Error('transport aborted')), { once: true }) })\n`,
    )
    const before = await snapshotTree(configDir)
    const child = spawn(
      bun,
      ['--preload', preload, CLI_PATH, '--output', 'ndjson', '--non-interactive', '--timeout', '100ms', 'capabilities'],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          HOME: home,
          NO_COLOR: '1',
          PATH: `/usr/bin:/bin${delimiter}${dirname(bun)}`,
          USERPROFILE: home,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    try {
      const [exitCode, stdout, stderr] = await Promise.all([
        waitForExit(child, 3_000),
        readStream(child.stdout),
        readStream(child.stderr),
      ])
      const documents = parseJsonDocuments(`${stdout}\n${stderr}`)
      const timeout = documents.findLast(entry => (entry.data ?? entry).error?.code === 'TIMEOUT')

      expect(exitCode).toBe(10)
      expect(timeout?.data ?? timeout).toMatchObject({
        error: { code: 'TIMEOUT', details: { timeoutMs: 100 } },
        ok: false,
      })
      expect(documents.some(entry => (entry.data ?? entry).ok === true)).toBe(false)
      expect(await snapshotTree(configDir)).toEqual(before)
    } finally {
      if (child.pid && isProcessAlive(child.pid)) child.kill('SIGKILL')
      await rm(root, { force: true, recursive: true })
    }
  }, 10_000)
})

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

async function snapshotTree(root: string): Promise<Array<{ body?: string; path: string; type: 'directory' | 'file' }>> {
  const snapshot: Array<{ body?: string; path: string; type: 'directory' | 'file' }> = []
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      const relativePath = relative(root, path)
      if (entry.isDirectory()) {
        snapshot.push({ path: relativePath, type: 'directory' })
        await visit(path)
      } else {
        snapshot.push({ body: (await readFile(path)).toString('base64'), path: relativePath, type: 'file' })
      }
    }
  }
  await visit(root)
  return snapshot.sort((left, right) => left.path.localeCompare(right.path))
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

function parseJsonDocuments(output: string): JsonDocument[] {
  const documents: JsonDocument[] = []
  let depth = 0
  let start = -1
  let escaped = false
  let quoted = false
  for (let index = 0; index < output.length; index += 1) {
    const character = output[index]!
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
      if (depth === 0 && start >= 0) documents.push(JSON.parse(output.slice(start, index + 1)))
    }
  }
  return documents
}
