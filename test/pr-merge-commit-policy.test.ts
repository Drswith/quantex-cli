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

const cleanCommits = [
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
    expect(validatePullRequestMergeCommitPolicy({ commits: [cleanCommits[0]!] })).toEqual([])
  })

  it.each([
    ['ordinary', {}],
    ['former main sync', { baseBranch: integrationBranch, headBranch: 'main', sameRepository: true }],
    ['former final promotion', { baseBranch: 'main', headBranch: integrationBranch, sameRepository: true }],
  ])('rejects multiple commits for the %s shape', (_, formerTopology) => {
    const issues = validatePullRequestMergeCommitPolicy({ commits: cleanCommits, ...formerTopology })

    expect(issues).toContainEqual(expect.stringContaining('Pull request contains 2 commits'))
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
          message: 'chore: release 0.29.1',
          sha: '88261fb1b9c4fbe11e2a5b883fc84a8bcb62f1f1',
        },
      ],
    })

    expect(issues).toContainEqual(expect.stringContaining('Re-author the commit'))
  })

  it('accepts the trusted release bot author for validated release PRs', () => {
    expect(
      validatePullRequestMergeCommitPolicy({
        commits: [
          {
            authorEmail: '279595574+quantex-cli-release-bot[bot]@users.noreply.github.com',
            authorName: 'quantex-cli-release-bot[bot]',
            message: 'chore: release 0.29.1',
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

  it('removes temporary topology inputs from the workflow policy step', () => {
    const policyStep = extractNamedStep(prGovernanceWorkflow, 'Validate PR merge commit policy')

    expect(policyStep).toContain('PR_COMMITS_JSON')
    expect(policyStep).toContain('PR_IS_VALIDATED_RELEASE_PR')
    expect(policyStep).not.toContain('PR_BASE_BRANCH')
    expect(policyStep).not.toContain('PR_HEAD_BRANCH')
    expect(policyStep).not.toContain('PR_SAME_REPOSITORY')
  })
})
