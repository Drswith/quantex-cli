import { execFileSync } from 'node:child_process'
import process from 'node:process'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Publish the merged Quantex release from protected main.

Usage:
  bun run release:publish

What it does:
  1. verifies the worktree is clean
  2. switches to main
  3. fast-forwards local main from origin/main
  4. creates the release tag for package.json version
  5. pushes the tag to trigger the release workflow
`)
  process.exit(0)
}

ensureCleanWorktree()
runGit(['switch', 'main'], { inheritOutput: true })
runGit(['fetch', 'origin', 'main'], { inheritOutput: true })
runGit(['merge', '--ff-only', 'origin/main'], { inheritOutput: true })
runBun(['run', 'release:tag', '--', '--push'])

function ensureCleanWorktree() {
  const status = runGit(['status', '--short']).trim()
  if (status) {
    console.error('release:publish requires a clean worktree. Commit, stash, or discard local changes first.')
    process.exit(1)
  }
}

function runGit(args: string[], options: { inheritOutput?: boolean } = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: options.inheritOutput ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  })
}

function runBun(args: string[]) {
  execFileSync('bun', args, {
    encoding: 'utf8',
    stdio: 'inherit',
  })
}
