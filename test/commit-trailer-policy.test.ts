import { describe, expect, it } from 'vitest'
import { validateCommitTrailerPolicy } from '../scripts/commit-trailer-policy'

describe('commit trailer policy', () => {
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
