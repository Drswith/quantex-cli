import { describe, expect, it } from 'vitest'
import { stripCursorAttributionTrailers } from '../scripts/strip-cursor-coauthor'

describe('stripCursorAttributionTrailers', () => {
  it('removes the Cursor co-author trailer', () => {
    expect(
      stripCursorAttributionTrailers(
        [
          'fix(schema): align doctor JSON schema with Cargo installer field',
          '',
          'Co-authored-by: Cursor Agent <cursoragent@cursor.com>',
          '',
        ].join('\n'),
      ),
    ).toBe(['fix(schema): align doctor JSON schema with Cargo installer field', '', ''].join('\n'))
  })

  it('leaves other co-author trailers untouched', () => {
    const message = ['docs: note authorship', '', 'Co-authored-by: Example Person <person@example.com>', ''].join('\n')

    expect(stripCursorAttributionTrailers(message)).toBe(message)
  })

  it('accepts the shorter Cursor name variant case-insensitively', () => {
    expect(
      stripCursorAttributionTrailers(
        ['chore: example', '', 'co-authored-by: cursor <cursoragent@cursor.com>'].join('\n'),
      ),
    ).toBe(['chore: example', ''].join('\n'))
  })

  it('removes the Made-with Cursor trailer', () => {
    expect(stripCursorAttributionTrailers(['feat: example', '', 'Made-with: Cursor', ''].join('\n'))).toBe(
      ['feat: example', '', ''].join('\n'),
    )
  })
})
