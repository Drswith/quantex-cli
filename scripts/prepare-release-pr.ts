import { execFileSync, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

const extraArgs = process.argv.slice(2)

if (extraArgs.includes('--help') || extraArgs.includes('-h')) {
  console.log(`Prepare a release branch and PR for the next Quantex version.

Usage:
  bun run release
  bun run release -- --release patch
  bun run release -- --release prerelease --preid beta

What it does:
  1. verifies the worktree is clean
  2. syncs local main with origin/main
  3. creates a release branch
  4. runs bumpp interactively without tagging or pushing
  5. renames the branch to codex/release-v<version>
  6. pushes the branch
  7. opens a PR with the required governance sections
  8. lets the merge-to-main release workflow publish automatically after the PR is merged
`)
  process.exit(0)
}

ensureCleanWorktree()
switchToMainAndSync()

const previousVersion = await readVersion()
const tempBranch = `codex/release-prep-${Date.now()}`
runGit(['switch', '-c', tempBranch], { inheritOutput: true })

const bumppResult = spawnSync('bunx', ['bumpp', '--no-tag', '--no-push', ...extraArgs], {
  stdio: 'inherit',
})

if (bumppResult.status !== 0) {
  console.error(`Release preparation stopped with exit code ${bumppResult.status ?? 1}.`)
  process.exit(bumppResult.status ?? 1)
}

const nextVersion = await readVersion()
if (!nextVersion || nextVersion === previousVersion) {
  console.error('Version did not change. Release preparation was aborted before a new version was selected.')
  process.exit(1)
}

const finalBranch = `codex/release-v${nextVersion}`
ensureBranchDoesNotExist(finalBranch)
runGit(['branch', '-m', finalBranch], { inheritOutput: true })
runGit(['push', '-u', 'origin', finalBranch], { inheritOutput: true })

const title = `chore(release): prepare v${nextVersion}`
const prBody = `## Summary
- prepare release v${nextVersion} with a version bump commit from bumpp
- let the merge-to-main release workflow publish automatically after approval

## Linked Artifacts
- task: autonomy/tasks/qtx-0027-make-release-flow-compatible-with-pr-only-main.md
- doc: docs/runbooks/releasing-quantex.md

## Validation
- bun run release -- --help
- bun run memory:check
- bun run lint
- bun run typecheck
- bun run test

## Docs Updated
- docs/runbooks/releasing-quantex.md

## Scope Check
- This PR only prepares the release version bump.
- Tag creation and publication happen automatically after the PR is merged into main.
`

try {
  const prUrl = runGh(['pr', 'create', '--base', 'main', '--head', finalBranch, '--title', title, '--body', prBody]).trim()
  console.log(`Opened release PR: ${prUrl}`)
}
catch {
  console.log(`Release branch pushed: ${finalBranch}`)
  console.log('Open a PR to main after reviewing the version bump commit.')
}

async function readVersion() {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string }
  return packageJson.version?.trim() ?? ''
}

function ensureCleanWorktree() {
  const status = runGit(['status', '--short']).trim()
  if (status) {
    console.error('release requires a clean worktree. Commit, stash, or discard local changes first.')
    process.exit(1)
  }
}

function switchToMainAndSync() {
  runGit(['switch', 'main'], { inheritOutput: true })
  runGit(['fetch', 'origin', 'main'], { inheritOutput: true })
  runGit(['merge', '--ff-only', 'origin/main'], { inheritOutput: true })
}

function ensureBranchDoesNotExist(branchName: string) {
  const branches = runGit(['branch', '--list', branchName]).trim()
  if (branches) {
    console.error(`Branch ${branchName} already exists locally.`)
    process.exit(1)
  }
}

function runGit(args: string[], options: { inheritOutput?: boolean } = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: options.inheritOutput ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  })
}

function runGh(args: string[]) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}
