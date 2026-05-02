import { describe, expect, it } from 'vitest'
import { mergePrBodyForGovernance } from '../scripts/merge-pr-body-for-governance'
import { validatePrBodyPolicy } from '../scripts/pr-body-policy'

describe('mergePrBodyForGovernance', () => {
  it('appends governance appendix so short automation bodies pass policy', () => {
    const shortBody = `## Summary

Fixes a correctness bug in the shared command runtime.

## OpenSpec

- Updated \`openspec/changes/add-self-upgrade-notice\`.

## Validation

- \`bun run test\`
`

    const merged = mergePrBodyForGovernance(shortBody)
    expect(merged).toContain('## Linked Artifacts')
    expect(validatePrBodyPolicy({ body: merged, changedFiles: ['src/cli.ts'], title: 'fix: example' })).toEqual([])
  })
})
