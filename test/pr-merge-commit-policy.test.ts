import { describe, expect, it } from 'vitest'
import { validatePullRequestMergeCommitPolicy } from '../scripts/pr-merge-commit-policy'

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
})
