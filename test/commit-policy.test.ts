import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validatePullRequestCommitPolicy } from '../scripts/ci/commit-policy'

const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8')

function extractNamedStep(workflow: string, stepName: string): string {
  const marker = `      - name: ${stepName}\n`
  const startIndex = workflow.indexOf(marker)
  if (startIndex === -1) throw new Error(`Missing workflow step: ${stepName}`)

  const remainingWorkflow = workflow.slice(startIndex + marker.length)
  const nextStepIndex = remainingWorkflow.indexOf('\n      - ')
  const endIndex = nextStepIndex === -1 ? workflow.length : startIndex + marker.length + nextStepIndex

  return workflow.slice(startIndex, endIndex)
}

const maintainerCommit = {
  authorEmail: 'maintainer@example.com',
  authorName: 'Maintainer',
  message: 'feat(lifecycle): add reconciliation',
  sha: 'a'.repeat(40),
}

describe('pull request commit policy', () => {
  it('ignores pull requests that do not request a one-shot release', () => {
    expect(validatePullRequestCommitPolicy({ body: '## Summary\n\nNo release.', commits: [maintainerCommit] })).toEqual(
      [],
    )
  })

  it('requires a Release-As source PR commit to carry the declared footer', () => {
    const issues = validatePullRequestCommitPolicy({
      body: '## Release Summary\n\nRelease-As: 2.0.0',
      commits: [maintainerCommit],
    })

    expect(issues).toContainEqual(expect.stringContaining('no pull request commit carries the same Release-As footer'))
  })

  it('accepts a Release-As source PR when its commit carries the same footer', () => {
    const issues = validatePullRequestCommitPolicy({
      body: '## Release Summary\n\nRelease-As: 2.0.0',
      commits: [{ ...maintainerCommit, message: 'chore(release): graduate engine\n\nRelease-As: 2.0.0' }],
    })

    expect(issues).toEqual([])
  })

  it('fails closed when a Release-As PR supplies no commit metadata', () => {
    const issues = validatePullRequestCommitPolicy({ body: '## Release Summary\n\nRelease-As: 2.0.0', commits: [] })

    expect(issues).toContainEqual(expect.stringContaining('no pull request commit metadata was supplied'))
  })

  it('does not demand a Release-As commit footer on release-please pull requests', () => {
    const issues = validatePullRequestCommitPolicy({
      body: '## Release Summary\n\nRelease-As: 2.0.0',
      commits: [
        {
          authorEmail: '279595574+quantex-cli-release-bot[bot]@users.noreply.github.com',
          authorName: 'quantex-cli-release-bot[bot]',
          message: 'chore: release 2.0.0',
          sha: 'c'.repeat(40),
        },
      ],
      headBranch: 'release-please--branches--main',
    })

    expect(issues).toEqual([])
  })

  it('accepts multi-commit pull requests and any author identity', () => {
    const issues = validatePullRequestCommitPolicy({
      body: '## Summary\n\nNo release.',
      commits: [
        maintainerCommit,
        {
          authorEmail: 'cursoragent@cursor.com',
          authorName: 'Cursor Agent',
          message: 'fix: follow-up\n\nCo-authored-by: Somebody <somebody@example.com>',
          sha: 'b'.repeat(40),
        },
      ],
    })

    expect(issues).toEqual([])
  })

  it('routes commit policy through the CI governance job', () => {
    const policyStep = extractNamedStep(ciWorkflow, 'Validate PR commit policy')

    expect(policyStep).toContain('PR_COMMITS_JSON')
    expect(policyStep).toContain('PR_BODY')
    expect(policyStep).toContain('PR_HEAD_BRANCH')
  })

  it('no longer gates on commit authorship or branch commit count', () => {
    const policyScript = readFileSync('scripts/ci/commit-policy.ts', 'utf8')
    const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
      'simple-git-hooks': Record<string, string>
    }

    expect(policyScript).not.toContain('Co-authored-by:')
    expect(policyScript).not.toContain('cursoragent')
    expect(policyScript).not.toContain('Squash the branch')
    expect(ciWorkflow).not.toContain('Validate commit trailer policy')
    expect(manifest['simple-git-hooks']['commit-msg']).toBeUndefined()
  })

  // A commit message that named the markers literally hijacked its own parsing:
  // release-please read the fragment between them, failed, and dropped the commit.
  it('rejects a commit message containing a commit-override marker', () => {
    const issues = validatePullRequestCommitPolicy({
      body: 'Release-As: 1.11.0',
      commits: [
        {
          message:
            'fix(release): explain the mechanism\n\nText mentioning BEGIN_COMMIT_OVERRIDE inline.\n\nRelease-As: 1.11.0',
          sha: 'abcdef1234567890',
        },
      ],
    })

    expect(issues.join('\n')).toContain('contains a commit-override marker in its message')
  })

  // The exported predicates are import-time safe, but the CLI entry runs during module
  // evaluation. A module-scope const declared below it throws on access, which unit tests
  // that only import the module cannot see. Exercise the real entry point.
  it('runs as a CLI without a module-initialisation error', () => {
    const result = spawnSync('bun', ['run', 'scripts/ci/commit-policy.ts'], {
      encoding: 'utf8',
      env: { ...process.env, PR_BODY: 'no release footer here', PR_COMMITS_JSON: '[]' },
    })

    expect(`${result.stdout}${result.stderr}`).not.toContain('before initialization')
    expect(result.status).toBe(0)
  })
})
