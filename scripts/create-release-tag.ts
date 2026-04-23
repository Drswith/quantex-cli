import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Create the release tag for the current package version.

Usage:
  bun run release:tag
  bun run release:tag -- --push

Options:
  --push    Push the created tag to origin after creating it locally
  -h, --help  Show this help message
`)
  process.exit(0)
}

const push = process.argv.includes('--push')
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string }
const version = packageJson.version?.trim()

if (!version) {
  console.error('Could not determine the package version from package.json.')
  process.exit(1)
}

const tag = `v${version}`

ensureMainBranch()
ensureCleanWorktree()
ensureUpstreamIsSynced()
ensureLocalTagDoesNotExist(tag)

runGit(['tag', '-a', tag, '-m', `release: ${tag}`], { inheritOutput: true })

if (push) {
  runGit(['push', 'origin', tag], { inheritOutput: true })
  console.log(`Created and pushed ${tag}.`)
}
else {
  console.log(`Created ${tag}. Push it with: git push origin ${tag}`)
}

function ensureMainBranch() {
  const branch = runGit(['branch', '--show-current']).trim()
  if (branch !== 'main') {
    console.error(`release:tag must run from main. Current branch: ${branch || '(detached HEAD)'}.`)
    process.exit(1)
  }
}

function ensureCleanWorktree() {
  const status = runGit(['status', '--short']).trim()
  if (status) {
    console.error('release:tag requires a clean worktree. Commit, stash, or discard local changes first.')
    process.exit(1)
  }
}

function ensureUpstreamIsSynced() {
  const head = runGit(['rev-parse', 'HEAD']).trim()
  let upstream = ''

  try {
    upstream = runGit(['rev-parse', '@{u}']).trim()
  }
  catch {
    console.error('release:tag requires main to track an upstream branch. Run `git branch --set-upstream-to origin/main main` first.')
    process.exit(1)
  }

  if (head !== upstream) {
    console.error('release:tag requires local main to match its upstream. Run `git pull --ff-only` before tagging.')
    process.exit(1)
  }
}

function ensureLocalTagDoesNotExist(tagName: string) {
  try {
    runGit(['rev-parse', '--verify', `refs/tags/${tagName}`])
    console.error(`Tag ${tagName} already exists locally.`)
    process.exit(1)
  }
  catch {
  }
}

function runGit(args: string[], options: { inheritOutput?: boolean } = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: options.inheritOutput ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  })
}
