import process from 'node:process'

export interface CommitMetadata {
  authorEmail?: string
  authorName?: string
  message: string
  sha: string
}

export interface PullRequestCommitPolicyInput {
  body?: string
  commits: CommitMetadata[]
  headBranch?: string
}

// A one-shot release is requested in the PR body but consumed by release-please
// from the merged commit, so the two must agree or the release silently differs
// from what the PR asked for.
export function validatePullRequestCommitPolicy(input: PullRequestCommitPolicyInput): string[] {
  const releaseAsVersion = getReleaseAsVersion(input.body ?? '')
  if (!releaseAsVersion || isReleasePleasePullRequest(input.headBranch)) return []

  if (input.commits.length === 0) {
    return [
      [
        `Release-As source PR declares ${releaseAsVersion}, but no pull request commit metadata was supplied to verify it.`,
        'Ensure PR_COMMITS_JSON is populated from the CI context step.',
      ].join('\n'),
    ]
  }

  if (!input.commits.some(commit => getReleaseAsVersion(commit.message) === releaseAsVersion)) {
    return [
      `Release-As source PR declares ${releaseAsVersion}, but no pull request commit carries the same Release-As footer.`,
    ]
  }

  return []
}

if (import.meta.main) {
  const commits = parseCommits(process.argv.slice(2), process.env.PR_COMMITS_JSON)
  const issues = validatePullRequestCommitPolicy({
    body: process.env.PR_BODY,
    commits,
    headBranch: process.env.PR_HEAD_BRANCH,
  })

  if (issues.length > 0) {
    console.error('Commit policy check failed:\n')
    for (const issue of issues) console.error(`- ${issue}`)
    process.exit(1)
  }

  console.log('Commit policy check passed.')
}

function parseCommits(args: string[], commitsJsonEnv: string | undefined): CommitMetadata[] {
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

function getReleaseAsVersion(value: string): string | undefined {
  return value.match(/^release-as:\s*(\S+)\s*$/im)?.[1]
}

function isReleasePleasePullRequest(headBranch: string | undefined): boolean {
  return typeof headBranch === 'string' && headBranch.startsWith('release-please--branches--')
}
