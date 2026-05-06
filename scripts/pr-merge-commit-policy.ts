import process from 'node:process'

export interface PullRequestCommitMetadata {
  authorEmail?: string
  authorName?: string
  message: string
  sha: string
}

export interface PullRequestMergeCommitPolicyInput {
  commits: PullRequestCommitMetadata[]
}

const prohibitedTrailerPattern = /^co-authored-by:\s*/i
const riskyAuthorPatterns = [/cursoragent@cursor\.com/i, /^cursor agent$/i, /\[bot\]@users\.noreply\.github\.com$/i]

export function validatePullRequestMergeCommitPolicy(input: PullRequestMergeCommitPolicyInput): string[] {
  const commits = input.commits
  const issues: string[] = []

  for (const commit of commits) {
    const offendingLines = commit.message
      .split('\n')
      .map(line => line.trim())
      .filter(line => prohibitedTrailerPattern.test(line))

    for (const line of offendingLines) {
      issues.push(`Commit ${formatSha(commit.sha)} contains prohibited trailer: ${line}`)
    }
  }

  if (commits.length > 1) {
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
  const commits = parseCommits(process.argv.slice(2), process.env.PR_COMMITS_JSON)
  const issues = validatePullRequestMergeCommitPolicy({ commits })

  if (issues.length > 0) {
    console.error('PR merge commit policy check failed:\n')
    for (const issue of issues) console.error(`- ${issue}`)
    process.exit(1)
  }

  console.log('PR merge commit policy check passed.')
}

function parseCommits(args: string[], commitsJsonEnv: string | undefined): PullRequestCommitMetadata[] {
  let rawValue = commitsJsonEnv

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const nextValue = args[index + 1]

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
    throw new Error('Pull request commits must be a JSON array.')
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

function formatAuthor(commit: PullRequestCommitMetadata): string {
  if (commit.authorName && commit.authorEmail) return `${commit.authorName} <${commit.authorEmail}>`
  return commit.authorEmail ?? commit.authorName ?? '<unknown>'
}
