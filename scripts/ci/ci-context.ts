import { execFile } from 'node:child_process'
import { appendFile, readFile } from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

interface CommitContext {
  authorEmail?: string
  authorName?: string
  message: string
  sha: string
}

interface CiContext {
  changedFiles: string[] | null
  commits: CommitContext[]
  trustedPr: boolean
}

interface EventPayload {
  after?: string
  before?: string
  pull_request?: {
    head?: { repo?: { full_name?: string } }
    number?: number
  }
}

if (import.meta.main) {
  const context = await collectCiContext()
  await writeGithubOutputs(context)
  console.log(
    JSON.stringify({
      changed_files: context.changedFiles,
      commits: context.commits.length,
      trusted_pr: context.trustedPr,
    }),
  )
}

export async function collectCiContext(): Promise<CiContext> {
  const eventName = process.env.GITHUB_EVENT_NAME ?? ''
  const payload = await readEventPayload()

  if (eventName === 'pull_request') {
    const prNumber = payload.pull_request?.number
    if (!prNumber) throw new Error('pull_request event payload is missing pull_request.number.')

    const trustedPr = payload.pull_request?.head?.repo?.full_name === process.env.GITHUB_REPOSITORY
    const [changedFiles, commits] = await Promise.all([
      ghApiLines(`repos/${process.env.GITHUB_REPOSITORY}/pulls/${prNumber}/files`, '.[].filename'),
      ghApiJsonLines<CommitContext>(
        `repos/${process.env.GITHUB_REPOSITORY}/pulls/${prNumber}/commits`,
        '.[] | {sha: .sha, message: .commit.message, authorName: .commit.author.name, authorEmail: .commit.author.email}',
      ),
    ])

    return { changedFiles, commits, trustedPr }
  }

  if (eventName === 'push') {
    const before = payload.before ?? ''
    const after = payload.after ?? ''

    if (!before || /^0+$/.test(before) || !after) {
      return { changedFiles: null, commits: [], trustedPr: true }
    }

    const comparison = await ghApiJson<{
      commits?: Array<{ commit?: { author?: { email?: string; name?: string }; message?: string }; sha?: string }>
      files?: Array<{ filename?: string }>
    }>(`repos/${process.env.GITHUB_REPOSITORY}/compare/${before}...${after}`)

    const changedFiles = (comparison.files ?? []).flatMap(file => (file.filename ? [file.filename] : []))
    const commits = (comparison.commits ?? []).flatMap(commit => {
      if (!commit.sha || typeof commit.commit?.message !== 'string') return []
      return [
        {
          authorEmail: commit.commit.author?.email,
          authorName: commit.commit.author?.name,
          message: commit.commit.message,
          sha: commit.sha,
        },
      ]
    })

    return { changedFiles, commits, trustedPr: true }
  }

  return { changedFiles: null, commits: [], trustedPr: true }
}

async function readEventPayload(): Promise<EventPayload> {
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath) return {}

  try {
    return JSON.parse(await readFile(eventPath, 'utf8')) as EventPayload
  } catch {
    return {}
  }
}

async function ghApiLines(endpoint: string, jq: string): Promise<string[]> {
  const output = await ghApi(endpoint, jq)
  return output.split('\n').filter(line => line.length > 0)
}

async function ghApiJsonLines<T>(endpoint: string, jq: string): Promise<T[]> {
  const lines = await ghApiLines(endpoint, jq)
  return lines.map(line => JSON.parse(line) as T)
}

async function ghApiJson<T>(endpoint: string): Promise<T> {
  const output = await runGh(['api', endpoint])
  return JSON.parse(output) as T
}

async function ghApi(endpoint: string, jq: string): Promise<string> {
  return runGh(['api', endpoint, '--paginate', '--jq', jq])
}

async function runGh(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('gh', args, { env: process.env })
    return stdout.trim()
  } catch (error) {
    const stderr =
      typeof error === 'object' && error !== null && 'stderr' in error && typeof error.stderr === 'string'
        ? error.stderr.trim()
        : String(error)
    throw new Error(`gh ${args.join(' ')} failed.\n${stderr}`, { cause: error })
  }
}

async function writeGithubOutputs(context: CiContext): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) return

  const outputLines = [
    `changed_files=${JSON.stringify(context.changedFiles ?? [])}`,
    `changed_files_available=${String(context.changedFiles !== null)}`,
    `commits_json=${JSON.stringify(context.commits)}`,
    `trusted_pr=${String(context.trustedPr)}`,
  ]

  await appendFile(outputPath, `${outputLines.join('\n')}\n`)
}
