import { spawnSync } from 'node:child_process'
import process from 'node:process'

export interface CommitMetadata {
  authorEmail?: string
  authorName?: string
  message: string
  sha: string
}

export interface CommitTrailerPolicyInput {
  commits: CommitMetadata[]
}

export interface PullRequestMergeCommitPolicyInput {
  body?: string
  commits: CommitMetadata[]
  headBranch?: string
}

type CommitPolicyMode = 'local' | 'push' | 'pr'

// A commit message is multi-line, so neither newlines nor tabs can delimit git
// log records safely; use the ASCII unit and record separators instead.
const fieldSeparator = String.fromCharCode(0x1f)
const recordSeparator = String.fromCharCode(0x1e)
const gitLogFormat = '%H%x1f%an%x1f%ae%x1f%B%x1e'

// Comparing against the branch point rather than the upstream ref keeps local
// enforcement working after the first push, when upstream already equals HEAD.
const defaultComparisonBases = ['origin/main', 'main'] as const

const prohibitedTrailerPattern = /^co-authored-by:\s*/i
const riskyAuthorPatterns = [/cursoragent@cursor\.com/i, /^cursor agent$/i, /\[bot\]@users\.noreply\.github\.com$/i]

export function validateCommitTrailerPolicy(input: CommitTrailerPolicyInput): string[] {
  const issues: string[] = []

  for (const commit of input.commits) {
    const sha = commit.sha || '<unknown>'
    const message = commit.message || ''
    const offendingLines = message
      .split('\n')
      .map(line => line.trim())
      .filter(line => prohibitedTrailerPattern.test(line))

    for (const line of offendingLines) {
      issues.push(`Commit ${sha.slice(0, 12)} contains prohibited trailer: ${line}`)
    }
  }

  return issues
}

export function validateCommitAuthorPolicy(input: CommitTrailerPolicyInput): string[] {
  const issues: string[] = []

  for (const commit of input.commits) {
    const authorValues = [commit.authorEmail, commit.authorName].filter(Boolean) as string[]
    if (!authorValues.some(value => riskyAuthorPatterns.some(pattern => pattern.test(value)))) continue

    issues.push(
      [
        `Commit ${formatSha(commit.sha)} uses author metadata that can be re-emitted as a Co-authored-by trailer by GitHub squash merge.`,
        `Author: ${formatAuthor(commit)}`,
        'Re-author the commit to an allowed maintainer identity before merge.',
      ].join('\n'),
    )
  }

  return issues
}

export function validatePullRequestMergeCommitPolicy(input: PullRequestMergeCommitPolicyInput): string[] {
  const commits = input.commits
  const releaseAsVersion = getReleaseAsVersion(input.body ?? '')
  const issues: string[] = []

  if (commits.length === 0) {
    issues.push(
      [
        'No pull request commits were supplied, so merge commit policy cannot validate squash merge Co-authored-by trailer risk.',
        'Ensure PR_COMMITS_JSON is populated from the list-commits GitHub Actions step.',
      ].join('\n'),
    )
    return issues
  }

  issues.push(...validateCommitTrailerPolicy({ commits }))

  if (
    releaseAsVersion &&
    !isReleasePleasePullRequest(input.headBranch) &&
    !commits.some(commit => getReleaseAsVersion(commit.message) === releaseAsVersion)
  ) {
    issues.push(
      `Release-As source PR declares ${releaseAsVersion}, but no pull request commit carries the same Release-As footer.`,
    )
  }

  if (commits.length > 1 && !isReleasePleasePullRequest(input.headBranch)) {
    issues.push(
      [
        `Pull request contains ${commits.length} commits; GitHub squash merge can synthesize Co-authored-by trailers from multi-commit contributor metadata.`,
        'Squash the branch to one clean commit before merge.',
      ].join('\n'),
    )
  }

  issues.push(...validateCommitAuthorPolicy({ commits }))

  return issues
}

// Runs before a push, so it enforces only the rules that require rewriting
// commits to fix: a prohibited trailer and a risky author identity. The
// single-commit rule stays a merge-time gate, because blocking work-in-progress
// pushes would only teach contributors to reach for --no-verify.
export function validateLocalCommitPolicy(input: CommitTrailerPolicyInput): string[] {
  return [...validateCommitTrailerPolicy(input), ...validateCommitAuthorPolicy(input)]
}

export function parseGitLogRecords(rawValue: string): CommitMetadata[] {
  return rawValue
    .split(recordSeparator)
    .map(record => record.trim())
    .filter(Boolean)
    .map(record => {
      const [sha = '', authorName = '', authorEmail = '', message = ''] = record.split(fieldSeparator)
      return { authorEmail, authorName, message, sha }
    })
}

if (import.meta.main) {
  const mode = parseMode(process.argv.slice(2))

  if (mode === 'local') {
    const localCommits = resolveLocalCommits(parseBase(process.argv.slice(2)))

    if (!localCommits || localCommits.length === 0) {
      console.log('Commit policy check (local mode) passed (no commits to validate).')
      process.exit(0)
    }

    const localIssues = validateLocalCommitPolicy({ commits: localCommits })

    if (localIssues.length > 0) {
      console.error('Commit policy check (local mode) failed:\n')
      for (const issue of localIssues) console.error(`- ${issue}`)
      process.exit(1)
    }

    console.log(`Commit policy check (local mode) passed (${localCommits.length} commit(s)).`)
    process.exit(0)
  }

  const commits = parseCommits(
    process.argv.slice(2),
    mode === 'pr' ? process.env.PR_COMMITS_JSON : process.env.COMMITS_JSON,
  )
  const issues =
    mode === 'pr'
      ? validatePullRequestMergeCommitPolicy({
          body: process.env.PR_BODY,
          commits,
          headBranch: process.env.PR_HEAD_BRANCH,
        })
      : validateCommitTrailerPolicy({ commits })

  if (issues.length > 0) {
    console.error(`Commit policy check (${mode} mode) failed:\n`)
    for (const issue of issues) console.error(`- ${issue}`)
    process.exit(1)
  }

  console.log(`Commit policy check (${mode} mode) passed.`)
}

function runGit(args: string[]): string | undefined {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.error || result.status !== 0) return undefined
  return result.stdout
}

// Returns undefined when there is nothing meaningful to compare against. That
// must stay a clean no-op: a fresh repository, a missing remote, or a detached
// checkout is not a policy violation.
function resolveLocalCommits(baseOverride: string | undefined): CommitMetadata[] | undefined {
  const bases = baseOverride ? [baseOverride] : defaultComparisonBases
  const base = bases.find(candidate => runGit(['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`]))
  if (!base) return undefined

  const mergeBase = runGit(['merge-base', base, 'HEAD'])?.trim()
  if (!mergeBase) return undefined

  const log = runGit(['log', `${mergeBase}..HEAD`, `--format=${gitLogFormat}`])
  if (log === undefined) return undefined

  return parseGitLogRecords(log)
}

function parseMode(args: string[]): CommitPolicyMode {
  const modeIndex = args.indexOf('--mode')
  const mode = modeIndex >= 0 ? args[modeIndex + 1] : undefined

  if (mode !== 'local' && mode !== 'push' && mode !== 'pr') {
    throw new Error(
      'Usage: bun run scripts/ci/commit-policy.ts --mode <local|push|pr> [--commits-json <json>] [--base <ref>]',
    )
  }

  return mode
}

function parseBase(args: string[]): string | undefined {
  const baseIndex = args.indexOf('--base')
  return baseIndex >= 0 ? args[baseIndex + 1] : undefined
}

function parseCommits(args: string[], commitsJsonEnv: string | undefined): CommitMetadata[] {
  let rawValue = commitsJsonEnv

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const nextValue = args[index + 1]

    if (arg === '--mode' && nextValue) {
      index += 1
      continue
    }

    if (arg === '--commits-json' && nextValue) {
      rawValue = nextValue
      index += 1
      continue
    }

    throw new Error(`Unknown or incomplete argument: ${arg}`)
  }

  if (!rawValue) return []

  const parsedValue = JSON.parse(rawValue)
  if (!Array.isArray(parsedValue)) {
    throw new Error('Commits must be a JSON array.')
  }

  return parsedValue.map((value, index) => {
    if (
      typeof value !== 'object' ||
      value === null ||
      typeof value.sha !== 'string' ||
      typeof value.message !== 'string'
    ) {
      throw new Error(`Commit at index ${index} must include string sha and message fields.`)
    }

    return {
      authorEmail: typeof value.authorEmail === 'string' ? value.authorEmail : undefined,
      authorName: typeof value.authorName === 'string' ? value.authorName : undefined,
      message: value.message,
      sha: value.sha,
    }
  })
}

function formatSha(sha: string): string {
  return (sha || '<unknown>').slice(0, 12)
}

function formatAuthor(commit: CommitMetadata): string {
  if (commit.authorName && commit.authorEmail) return `${commit.authorName} <${commit.authorEmail}>`
  return commit.authorEmail ?? commit.authorName ?? '<unknown>'
}

function getReleaseAsVersion(value: string): string | undefined {
  return value.match(/^release-as:\s*(\S+)\s*$/im)?.[1]
}

function isReleasePleasePullRequest(headBranch: string | undefined): boolean {
  return typeof headBranch === 'string' && headBranch.startsWith('release-please--branches--')
}
