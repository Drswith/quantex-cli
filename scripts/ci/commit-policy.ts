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

type CommitPolicyMode = 'push' | 'pr'

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

  for (const commit of commits) {
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

if (import.meta.main) {
  const mode = parseMode(process.argv.slice(2))
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

function parseMode(args: string[]): CommitPolicyMode {
  const modeIndex = args.indexOf('--mode')
  const mode = modeIndex >= 0 ? args[modeIndex + 1] : undefined

  if (mode !== 'push' && mode !== 'pr') {
    throw new Error('Usage: bun run scripts/ci/commit-policy.ts --mode <push|pr> [--commits-json <json>]')
  }

  return mode
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
