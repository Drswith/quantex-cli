import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateCommitTrailerPolicy, validatePullRequestMergeCommitPolicy } from '../scripts/ci/commit-policy'

const integrationBranch = 'codex/redesign-lifecycle-integration'
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

describe('commit trailer policy (push mode)', () => {
  it('accepts commits without co-author trailers', () => {
    expect(
      validateCommitTrailerPolicy({
        commits: [
          {
            message: 'feat(agents): add deepseek tui support',
            sha: 'ca43b811dd86bfb33dde7aece06bff1dc26deed9',
          },
        ],
      }),
    ).toEqual([])
  })

  it('rejects co-authored-by trailers case-insensitively', () => {
    const issues = validateCommitTrailerPolicy({
      commits: [
        {
          message: [
            'chore: release 0.13.0',
            '',
            'Co-authored-by: quantex-release[bot] <41898282+github-actions[bot]@users.noreply.github.com>',
          ].join('\n'),
          sha: 'ed71cdd2256803d96035e49494ec7c9f3720b9fa',
        },
        {
          message: ['docs: example', '', 'co-authored-by: Example Bot <bot@example.com>'].join('\n'),
          sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      ],
    })

    expect(issues).toHaveLength(2)
    expect(issues[0]).toContain('ed71cdd22568')
    expect(issues[0]).toContain('Co-authored-by:')
    expect(issues[1]).toContain('aaaaaaaaaaaa')
    expect(issues[1]).toContain('co-authored-by:')
  })
})

describe('pr merge commit policy (pr mode)', () => {
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

  it('requires a Release-As source PR commit to carry the declared footer', () => {
    const body = '## Release Summary\n\nRelease-As: 2.0.0'
    const issues = validatePullRequestMergeCommitPolicy({ body, commits: [cleanCommits[0]!] })

    expect(issues).toContainEqual(expect.stringContaining('no pull request commit carries the same Release-As footer'))
  })

  it('accepts a Release-As source PR when its commit carries the same footer', () => {
    const body = '## Release Summary\n\nRelease-As: 2.0.0'
    const commits = [
      {
        ...cleanCommits[0]!,
        message: 'chore(release): graduate lifecycle engine\n\nRelease-As: 2.0.0',
      },
    ]

    expect(validatePullRequestMergeCommitPolicy({ body, commits })).toEqual([])
  })

  it('allows multiple commits on release-please pull requests', () => {
    const issues = validatePullRequestMergeCommitPolicy({
      commits: cleanCommits,
      headBranch: 'release-please--branches--main',
    })

    expect(issues).not.toContainEqual(expect.stringContaining('Pull request contains 2 commits'))
  })

  it('does not demand a Release-As commit footer on release-please pull requests', () => {
    const body = '## Release Summary\n\nRelease-As: 2.0.0'
    const issues = validatePullRequestMergeCommitPolicy({
      body,
      commits: [
        {
          authorEmail: '279595574+quantex-cli-release-bot[bot]@users.noreply.github.com',
          authorName: 'quantex-cli-release-bot[bot]',
          message: 'chore: release 2.0.0',
          sha: 'cccccccccccccccccccccccccccccccccccccccc',
        },
      ],
      headBranch: 'release-please--branches--main',
    })

    expect(issues).not.toContainEqual(expect.stringContaining('Release-As footer'))
  })

  it('routes merge commit policy through the CI governance job', () => {
    const policyStep = extractNamedStep(ciWorkflow, 'Validate PR merge commit policy')

    expect(policyStep).toContain('PR_COMMITS_JSON')
    expect(policyStep).toContain('PR_BODY')
    expect(policyStep).toContain('PR_HEAD_BRANCH')
  })
})
