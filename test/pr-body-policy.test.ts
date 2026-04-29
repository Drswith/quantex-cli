import { describe, expect, it } from 'vitest'
import { validatePrBodyPolicy } from '../scripts/pr-body-policy'

const validBody = `## Summary

Describe the change.

## Linked Artifacts

- Issue:
- ADR:
- OpenSpec: \`harden-agent-archive-closure\`
- Discussion:

## Validation

- [x] \`bun run lint\`

## Release Intent

- Release: not applicable - docs/process/test-only change

## Docs Updated

- [x] \`openspec/...\`

## Scope Check

- [x] I did not add a new ad hoc root-level Markdown file.

## Closure Check

- [x] Working tree was clean after commit.
`

describe('PR body policy', () => {
  it('accepts a governance-compliant body', () => {
    expect(
      validatePrBodyPolicy({
        body: validBody,
        changedFiles: ['openspec/specs/project-memory/spec.md'],
        title: 'docs(openspec): archive completed changes',
      }),
    ).toEqual([])
  })

  it('reports missing required headings before remote PR governance runs', () => {
    expect(
      validatePrBodyPolicy({
        body: '## Summary\n\nMissing the required governance template.',
        title: 'docs: incomplete body',
      }),
    ).toEqual([
      'PR body is missing required sections: ## Linked Artifacts, ## Validation, ## Release Intent, ## Docs Updated, ## Scope Check, ## Closure Check',
    ])
  })

  it('requires at least one meaningful linked artifact', () => {
    const body = validBody.replace('OpenSpec: `harden-agent-archive-closure`', 'OpenSpec:')

    expect(validatePrBodyPolicy({ body, title: 'docs: no artifact' })).toEqual([
      'PR body must link at least one issue, ADR, OpenSpec artifact, or discussion in the "Linked Artifacts" section.',
    ])
  })

  it('rejects release-worthy metadata for process-only changes', () => {
    const issues = validatePrBodyPolicy({
      body: validBody,
      changedFiles: ['openspec/specs/project-memory/spec.md'],
      title: 'fix: archive process docs',
    })

    expect(issues.join('\n')).toContain(
      'Release/process/docs/memory-only PRs must not use release-worthy conventional commit metadata.',
    )
  })

  it('rejects product-impacting no-release placeholders', () => {
    const body = validBody.replace(
      'Release: not applicable - docs/process/test-only change',
      'Release: not applicable - n/a',
    )
    const issues = validatePrBodyPolicy({
      body,
      changedFiles: ['src/cli.ts'],
      title: 'chore: touch cli',
    })

    expect(issues.join('\n')).toContain('Product-impacting PRs must not silently skip release automation.')
  })

  it('keeps release-please branches on dedicated release validation', () => {
    expect(
      validatePrBodyPolicy({
        body: validBody,
        changedFiles: ['package.json'],
        headBranch: 'release-please--branches--main--components--quantex-cli',
        title: 'chore: release 1.2.3',
      }),
    ).toEqual([])
  })
})
