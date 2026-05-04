import process from 'node:process'

export interface CommitMetadata {
  message: string
  sha: string
}

export interface CommitTrailerPolicyInput {
  commits: CommitMetadata[]
}

const prohibitedTrailerPattern = /^co-authored-by:\s*/i

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

if (import.meta.main) {
  const commits = parseCommits(process.argv.slice(2), process.env.COMMITS_JSON)
  const issues = validateCommitTrailerPolicy({ commits })

  if (issues.length > 0) {
    console.error('Commit trailer policy check failed:\n')
    for (const issue of issues) console.error(`- ${issue}`)
    process.exit(1)
  }

  console.log('Commit trailer policy check passed.')
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
      message: value.message,
      sha: value.sha,
    }
  })
}
