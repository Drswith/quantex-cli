import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectCiContext } from '../scripts/ci-context'

const ORIGINAL_ENV = { ...process.env }

// The fake-gh shim is a POSIX shell script; Windows runners cover the pure paths only.
const shimmedGh = it.skipIf(process.platform === 'win32')

let tempRoot = ''
let payloadPath = ''

beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), 'quantex-ci-context-'))
  payloadPath = join(tempRoot, 'event.json')
  process.env.GITHUB_EVENT_PATH = payloadPath
  process.env.GITHUB_REPOSITORY = 'Drswith/quantex-cli'
  delete process.env.GITHUB_OUTPUT
})

afterEach(async () => {
  process.env = { ...ORIGINAL_ENV }
  await rm(tempRoot, { force: true, recursive: true })
})

async function writePayload(payload: unknown): Promise<void> {
  await writeFile(payloadPath, JSON.stringify(payload), 'utf8')
}

async function installFakeGh(handler: string): Promise<void> {
  const binDir = join(tempRoot, 'bin')
  await mkdir(binDir, { recursive: true })
  const scriptPath = join(binDir, 'gh')
  await writeFile(scriptPath, `#!/bin/sh\n${handler}\n`, { mode: 0o755 })
  process.env.PATH = `${binDir}:${ORIGINAL_ENV.PATH ?? ''}`
}

describe('ci-context', () => {
  it('defaults to the full matrix when the event has no usable diff', async () => {
    process.env.GITHUB_EVENT_NAME = 'schedule'
    delete process.env.GITHUB_EVENT_PATH

    const context = await collectCiContext()

    expect(context).toEqual({ changedFiles: null, commits: [], trustedPr: true })
  })

  it('defaults to the full matrix for a push without a before sha', async () => {
    process.env.GITHUB_EVENT_NAME = 'push'
    await writePayload({ after: 'b'.repeat(40), before: '0'.repeat(40) })

    const context = await collectCiContext()

    expect(context).toEqual({ changedFiles: null, commits: [], trustedPr: true })
  })

  shimmedGh('collects files, commits, and trust for same-repository pull requests', async () => {
    process.env.GITHUB_EVENT_NAME = 'pull_request'
    await writePayload({
      pull_request: {
        head: { repo: { full_name: 'Drswith/quantex-cli' } },
        number: 42,
      },
    })
    await installFakeGh(
      [
        'if [ "$2" = "repos/Drswith/quantex-cli/pulls/42/files" ]; then',
        "  printf 'src/cli.ts\\ndocs/README.md\\n'",
        '  exit 0',
        'fi',
        'if [ "$2" = "repos/Drswith/quantex-cli/pulls/42/commits" ]; then',
        '  echo \'{"sha":"aaa","message":"feat: x","authorName":"Dev","authorEmail":"dev@example.com"}\'',
        '  exit 0',
        'fi',
        'echo "unexpected gh args: $@" >&2',
        'exit 1',
      ].join('\n'),
    )

    const context = await collectCiContext()

    expect(context.changedFiles).toEqual(['src/cli.ts', 'docs/README.md'])
    expect(context.commits).toEqual([
      { authorEmail: 'dev@example.com', authorName: 'Dev', message: 'feat: x', sha: 'aaa' },
    ])
    expect(context.trustedPr).toBe(true)
  })

  shimmedGh('marks fork pull requests as untrusted', async () => {
    process.env.GITHUB_EVENT_NAME = 'pull_request'
    await writePayload({
      pull_request: {
        head: { repo: { full_name: 'someone/quantex-cli-fork' } },
        number: 7,
      },
    })
    await installFakeGh(
      'if [ "$2" = "repos/Drswith/quantex-cli/pulls/7/files" ]; then printf \'src/cli.ts\\n\'; exit 0; fi\nif [ "$2" = "repos/Drswith/quantex-cli/pulls/7/commits" ]; then exit 0; fi\nexit 1',
    )

    const context = await collectCiContext()

    expect(context.trustedPr).toBe(false)
  })

  shimmedGh('collects files and commits for push events through compare', async () => {
    process.env.GITHUB_EVENT_NAME = 'push'
    const before = 'a'.repeat(40)
    const after = 'b'.repeat(40)
    await writePayload({ after, before })
    await installFakeGh(
      `echo '{"files":[{"filename":"package.json"}],"commits":[{"sha":"ccc","commit":{"message":"chore: release 1.8.2","author":{"name":"Bot","email":"bot@example.com"}}}]}'`,
    )

    const context = await collectCiContext()

    expect(context.changedFiles).toEqual(['package.json'])
    expect(context.commits).toEqual([
      { authorEmail: 'bot@example.com', authorName: 'Bot', message: 'chore: release 1.8.2', sha: 'ccc' },
    ])
    expect(context.trustedPr).toBe(true)
  })

  it('fails closed when gh api fails', async () => {
    process.env.GITHUB_EVENT_NAME = 'pull_request'
    await writePayload({
      pull_request: {
        head: { repo: { full_name: 'Drswith/quantex-cli' } },
        number: 9,
      },
    })
    await installFakeGh('echo boom >&2\nexit 1')

    await expect(collectCiContext()).rejects.toThrow(/gh api/)
  })
})
