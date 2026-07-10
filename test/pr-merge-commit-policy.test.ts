import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validatePullRequestMergeCommitPolicy } from '../scripts/pr-merge-commit-policy'

const integrationBranch = 'codex/redesign-lifecycle-integration'
const prGovernanceWorkflow = readFileSync('.github/workflows/pr-governance.yml', 'utf8')

function extractNamedStep(workflow: string, stepName: string): string {
  const marker = `      - name: ${stepName}\n`
  const startIndex = workflow.indexOf(marker)
  if (startIndex === -1) throw new Error(`Missing workflow step: ${stepName}`)

  const remainingWorkflow = workflow.slice(startIndex + marker.length)
  const nextStepIndex = remainingWorkflow.indexOf('\n      - ')
  const endIndex = nextStepIndex === -1 ? workflow.length : startIndex + marker.length + nextStepIndex

  return workflow.slice(startIndex, endIndex)
}

const mainSyncCommits = [
  {
    authorEmail: 'cursoragent@cursor.com',
    authorName: 'Cursor Agent',
    message: 'fix(ci): preserve accepted main history',
    sha: 'a1bf9b84bb9d44cd7dfc3eb8c04d717d94a2403a',
  },
  {
    authorEmail: '279595574+quantex-cli-release-bot[bot]@users.noreply.github.com',
    authorName: 'quantex-cli-release-bot[bot]',
    message: 'chore: release 0.29.0',
    sha: 'faccfe099ca1de911087caf6904263ae22283e22',
  },
]

const cleanPromotionCommits = [
  {
    authorEmail: '540628938@qq.com',
    authorName: 'drswith',
    message: 'refactor(core): establish lifecycle engine foundation',
    sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  },
  {
    authorEmail: 'drswith@outlook.com',
    authorName: 'Drswith',
    message: 'refactor(providers): migrate provider catalog',
    sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  },
]

describe('pr merge commit policy', () => {
  it('rejects empty commit metadata so the policy cannot fail open', () => {
    const issues = validatePullRequestMergeCommitPolicy({ commits: [] })

    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain('No pull request commits were supplied')
    expect(issues[0]).toContain('PR_COMMITS_JSON')
  })

  it('accepts one clean maintainer-authored commit', () => {
    expect(
      validatePullRequestMergeCommitPolicy({
        commits: [
          {
            authorEmail: '540628938@qq.com',
            authorName: 'drswith',
            message: 'ci: tighten PR governance',
            sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
        ],
      }),
    ).toEqual([])
  })

  it('rejects multiple commits because GitHub squash can synthesize co-author trailers', () => {
    const issues = validatePullRequestMergeCommitPolicy({
      commits: [
        {
          authorEmail: 'cursoragent@cursor.com',
          authorName: 'Cursor Agent',
          message: 'fix(ci): load release PR policy from trusted base ref',
          sha: 'a1bf9b84bb9d44cd7dfc3eb8c04d717d94a2403a',
        },
        {
          authorEmail: '540628938@qq.com',
          authorName: 'drswith',
          message: 'Merge remote-tracking branch origin/main',
          sha: 'faccfe099ca1de911087caf6904263ae22283e22',
        },
      ],
    })

    expect(issues).toContainEqual(expect.stringContaining('Pull request contains 2 commits'))
    expect(issues).toContainEqual(expect.stringContaining('a1bf9b84bb9d'))
  })

  it('accepts multiple commits only for an exact same-repository main sync', () => {
    expect(
      validatePullRequestMergeCommitPolicy({
        baseBranch: integrationBranch,
        commits: mainSyncCommits,
        headBranch: 'main',
        sameRepository: true,
      }),
    ).toEqual([])
  })

  it('accepts multiple clean commits for the exact same-repository final promotion', () => {
    expect(
      validatePullRequestMergeCommitPolicy({
        baseBranch: 'main',
        commits: cleanPromotionCommits,
        headBranch: integrationBranch,
        sameRepository: true,
      }),
    ).toEqual([])
  })

  it.each([
    ['fork main sync', integrationBranch, 'main', false],
    ['fork final promotion', 'main', integrationBranch, false],
    ['lookalike main sync', `${integrationBranch}-staging`, 'main', true],
    ['other protected source', integrationBranch, 'beta', true],
    ['lookalike final promotion', 'main', `${integrationBranch}-staging`, true],
  ])('rejects multiple commits for %s', (_, baseBranch, headBranch, sameRepository) => {
    const issues = validatePullRequestMergeCommitPolicy({
      baseBranch,
      commits: cleanPromotionCommits,
      headBranch,
      sameRepository,
    })

    expect(issues).toContainEqual(expect.stringContaining('Pull request contains 2 commits'))
  })

  it('retains risky-author validation for final promotion history', () => {
    const issues = validatePullRequestMergeCommitPolicy({
      baseBranch: 'main',
      commits: mainSyncCommits,
      headBranch: integrationBranch,
      sameRepository: true,
    })

    expect(issues).not.toContainEqual(expect.stringContaining('Pull request contains 2 commits'))
    expect(issues).toContainEqual(expect.stringContaining('a1bf9b84bb9d'))
  })

  it('rejects known agent commit authors even for single-commit PRs', () => {
    const issues = validatePullRequestMergeCommitPolicy({
      commits: [
        {
          authorEmail: 'cursoragent@cursor.com',
          authorName: 'Cursor Agent',
          message: 'fix(self-upgrade): avoid false managed verify when latestVersion unresolved',
          sha: 'bdc8bde0a7e5d5fc689dd6144ecafed336f165b6',
        },
      ],
    })

    expect(issues).toContainEqual(expect.stringContaining('bdc8bde0a7e5'))
    expect(issues).toContainEqual(expect.stringContaining('Re-author the commit'))
  })

  it('rejects the release bot author on unvalidated pull requests', () => {
    const issues = validatePullRequestMergeCommitPolicy({
      commits: [
        {
          authorEmail: '279595574+quantex-cli-release-bot[bot]@users.noreply.github.com',
          authorName: 'quantex-cli-release-bot[bot]',
          message: 'chore: release 0.16.0',
          sha: '88261fb1b9c4fbe11e2a5b883fc84a8bcb62f1f1',
        },
      ],
    })

    expect(issues).toContainEqual(expect.stringContaining('88261fb1b9c4'))
    expect(issues).toContainEqual(expect.stringContaining('Re-author the commit'))
  })

  it('accepts the trusted release bot author for validated release PRs', () => {
    expect(
      validatePullRequestMergeCommitPolicy({
        commits: [
          {
            authorEmail: '279595574+quantex-cli-release-bot[bot]@users.noreply.github.com',
            authorName: 'quantex-cli-release-bot[bot]',
            message: 'chore: release 0.16.0',
            sha: '88261fb1b9c4fbe11e2a5b883fc84a8bcb62f1f1',
          },
        ],
        validatedReleasePr: true,
      }),
    ).toEqual([])
  })

  it('rejects direct co-author trailers in PR commit messages', () => {
    const issues = validatePullRequestMergeCommitPolicy({
      commits: [
        {
          authorEmail: '540628938@qq.com',
          authorName: 'drswith',
          message: ['ci: example', '', 'Co-authored-by: Cursor Agent <cursoragent@cursor.com>'].join('\n'),
          sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      ],
    })

    expect(issues).toContainEqual(expect.stringContaining('Co-authored-by:'))
  })

  it('rejects direct co-author trailers even for an exact main sync', () => {
    const issues = validatePullRequestMergeCommitPolicy({
      baseBranch: integrationBranch,
      commits: [
        {
          authorEmail: '540628938@qq.com',
          authorName: 'drswith',
          message: ['chore(integration): sync main', '', 'Co-authored-by: Cursor Agent <cursoragent@cursor.com>'].join(
            '\n',
          ),
          sha: 'cccccccccccccccccccccccccccccccccccccccc',
        },
        cleanPromotionCommits[0]!,
      ],
      headBranch: 'main',
      sameRepository: true,
    })

    expect(issues).toContainEqual(expect.stringContaining('Co-authored-by:'))
  })

  it('passes immutable pull-request topology fields to the workflow policy step', () => {
    const policyStep = extractNamedStep(prGovernanceWorkflow, 'Validate PR merge commit policy')

    expect(policyStep).toContain('PR_BASE_BRANCH: ${{ github.event.pull_request.base.ref }}')
    expect(policyStep).toContain('PR_HEAD_BRANCH: ${{ github.event.pull_request.head.ref }}')
    expect(policyStep).toContain(
      'PR_SAME_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name == github.repository }}',
    )
  })
})
