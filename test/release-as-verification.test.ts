import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { describeVerification, verifyReleaseAs } from '../scripts/release/verify-release-as'

// The failing bodies are the real ones from PRs #670, #671, and #672. Each declared
// Release-As 1.11.0, was reviewed, passed every check, merged, and produced no release,
// because nothing verified the declaration against release-please's own parser. This
// suite runs that parser, so each failure mode stays reproducible without a merge.
function body(name: number | string): string {
  const file = typeof name === 'number' ? `pr-${name}-body.md` : `${name}.md`

  return readFileSync(`test/fixtures/release-as/${file}`, 'utf8')
}

describe('Release-As verification against the real parser', () => {
  it('rejects a footer placed after the override block (#670, #671)', () => {
    for (const pr of [670, 671]) {
      const result = verifyReleaseAs({ body: body(pr), message: 'chore: placeholder' })

      expect(result.declaredVersion).toBe('1.11.0')
      expect(result.appliedVersions).toEqual([])
      expect(describeVerification(result).join('\n')).toContain('would not apply it')
    }
  })

  it('rejects a body whose markers drop the commit entirely (#672)', () => {
    const result = verifyReleaseAs({
      body: body(672),
      // The message that named the markers inline; release-please parses the fragment
      // between them, fails, and discards the commit along with its footer.
      message: readFileSync('test/fixtures/release-as/pr-672-message.txt', 'utf8'),
    })

    expect(result.parsedCommitCount).toBe(0)
    expect(describeVerification(result).join('\n')).toContain('parses no commit at all')
  })

  it('accepts a footer inside the override block', () => {
    const result = verifyReleaseAs({ body: body('corrected-body'), message: 'chore: placeholder' })

    expect(result.appliedVersions).toContain('1.11.0')
    expect(describeVerification(result)).toEqual([])
  })

  it('stays silent when no version override is declared', () => {
    const result = verifyReleaseAs({ body: '## Summary\n\nNothing to declare.\n', message: 'fix: something' })

    expect(result.declaredVersion).toBeUndefined()
    expect(describeVerification(result)).toEqual([])
  })
})
