import { describe, expect, it } from 'vitest'
import { validatePrBodyPolicy } from '../scripts/ci/pr-body-policy'

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

## Release Summary

- Not applicable - this change does not produce a release entry.

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
      'PR body is missing required sections: ## Linked Artifacts, ## Validation, ## Release Intent, ## Release Summary, ## Docs Updated, ## Scope Check, ## Closure Check',
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

  // release-please computes a bump from every marker in the `<last tag>..main` range, so a
  // stale marker keeps forcing that bump until a release lands after it. Moving the boundary
  // needs a PR whose only release-worthy signal is `Release-As`, and that PR has no product
  // change to carry, so it would otherwise be rejected as process-only.
  describe('release-boundary-only Release-As', () => {
    // A boundary PR is still release-worthy, so it must carry a commit override for
    // release-please and repeat the footer under Release Summary.
    const boundaryBody = validBody.replace(
      '- Not applicable - this change does not produce a release entry.',
      [
        'BEGIN_COMMIT_OVERRIDE',
        'fix(release): prepare the 1.11.0 boundary',
        '',
        'Release-As: 1.11.0',
        'END_COMMIT_OVERRIDE',
      ].join('\n'),
    )

    it('allows a process-only PR to move the release boundary within the current major', () => {
      expect(
        validatePrBodyPolicy({
          body: boundaryBody,
          changedFiles: ['openspec/changes/some-change/tasks.md'],
          currentMajor: 1,
          title: 'docs(openspec): record the one-shot preparation',
        }),
      ).toEqual([])
    })

    it('still refuses to let a process-only PR reach a higher major', () => {
      const issues = validatePrBodyPolicy({
        body: boundaryBody.replaceAll('1.11.0', '2.0.0'),
        changedFiles: ['openspec/changes/some-change/tasks.md'],
        currentMajor: 1,
        title: 'docs(openspec): record the one-shot preparation',
      })

      expect(issues.join('\n')).toContain(
        'Release/process/docs/memory-only PRs must not use release-worthy conventional commit metadata.',
      )
    })

    it('does not extend the allowance to a release-worthy title or a breaking footer', () => {
      const changedFiles = ['openspec/changes/some-change/tasks.md']

      expect(
        validatePrBodyPolicy({
          body: boundaryBody,
          changedFiles,
          currentMajor: 1,
          title: 'feat: sneak a release',
        }).join('\n'),
      ).toContain('Release/process/docs/memory-only PRs')
      expect(
        validatePrBodyPolicy({
          body: boundaryBody.replace('## Docs Updated', 'BREAKING CHANGE: no\n\n## Docs Updated'),
          changedFiles,
          currentMajor: 1,
          title: 'docs(openspec): record the one-shot preparation',
        }).join('\n'),
      ).toContain('Release/process/docs/memory-only PRs')
    })

    // Release-please replaces the merged commit message with the override block. A footer
    // after END_COMMIT_OVERRIDE is never parsed, so the release silently keeps the computed
    // version: this is what left quantex-cli unable to leave 2.0.0 across #670 and #671.
    it('requires the Release-As footer inside the commit override block', () => {
      const outside = validBody.replace(
        '- Not applicable - this change does not produce a release entry.',
        [
          'BEGIN_COMMIT_OVERRIDE',
          'fix(release): prepare the boundary',
          'END_COMMIT_OVERRIDE',
          '',
          'Release-As: 1.11.0',
        ].join('\n'),
      )
      const issues = validatePrBodyPolicy({
        body: outside,
        changedFiles: ['openspec/changes/some-change/tasks.md'],
        currentMajor: 1,
        title: 'docs(openspec): record the one-shot preparation',
      })

      expect(issues.join('\n')).toContain(
        'Release-As source PRs must declare the Release-As footer INSIDE the BEGIN_COMMIT_OVERRIDE block.',
      )
    })

    it('fails closed when the current major is unknown', () => {
      const issues = validatePrBodyPolicy({
        body: boundaryBody,
        changedFiles: ['openspec/changes/some-change/tasks.md'],
        title: 'docs(openspec): record the one-shot preparation',
      })

      expect(issues.join('\n')).toContain('Release/process/docs/memory-only PRs')
    })
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
    const body = validBody.replace(
      'Release: not applicable - docs/process/test-only change',
      'Release: not applicable - n/a',
    )

    expect(
      validatePrBodyPolicy({
        body,
        changedFiles: ['package.json'],
        title: 'chore: release 1.2.3',
        validatedReleasePr: true,
      }),
    ).toEqual([])
  })

  it('does not trust release-please branch naming without validated release policy', () => {
    const body = validBody.replace(
      'Release: not applicable - docs/process/test-only change',
      'Release: not applicable - n/a',
    )

    const issues = validatePrBodyPolicy({
      body,
      changedFiles: ['package.json'],
      headBranch: 'release-please--branches--main--components--quantex-cli',
      title: 'chore: release 1.2.3',
    })

    expect(issues.join('\n')).toContain('Product-impacting PRs must not silently skip release automation.')
  })

  it('requires a release-please commit override for release-worthy source PRs', () => {
    const body = validBody.replace(
      'Release: not applicable - docs/process/test-only change',
      'Release: minor - user-facing lifecycle behavior',
    )

    const issues = validatePrBodyPolicy({
      body,
      changedFiles: ['src/cli.ts'],
      title: 'feat: improve lifecycle reporting',
    })

    expect(issues.join('\n')).toContain('BEGIN_COMMIT_OVERRIDE')
  })

  it('accepts a user-facing commit override for release-worthy source PRs', () => {
    const body = validBody
      .replace(
        'Release: not applicable - docs/process/test-only change',
        'Release: minor - user-facing lifecycle behavior',
      )
      .replace(
        '- Not applicable - this change does not produce a release entry.',
        'BEGIN_COMMIT_OVERRIDE\nfeat: improve lifecycle reporting for managed agents\nEND_COMMIT_OVERRIDE',
      )

    expect(
      validatePrBodyPolicy({
        body,
        changedFiles: ['src/cli.ts'],
        title: 'feat: improve lifecycle reporting',
      }),
    ).toEqual([])
  })

  // A commit whose message explained this very mechanism named the markers literally.
  // release-please found them, parsed the sentence fragment between them, failed, and
  // dropped the commit from the release with its Release-As footer.
  it('rejects a stray commit-override marker elsewhere in the body', () => {
    const body =
      validBody.replace(
        '- Not applicable - this change does not produce a release entry.',
        [
          'BEGIN_COMMIT_OVERRIDE',
          'fix(release): prepare the boundary',
          '',
          'Release-As: 1.11.0',
          'END_COMMIT_OVERRIDE',
        ].join('\n'),
      ) + '\n\nProse that names BEGIN_COMMIT_OVERRIDE again by accident.\n'

    const issues = validatePrBodyPolicy({
      body,
      changedFiles: ['src/cli.ts'],
      title: 'fix: something',
    })

    expect(issues.join('\n')).toContain('occurrences of a commit-override marker')
  })

  it('treats Release-As source metadata as release-worthy and requires it inside the override', () => {
    const body = validBody
      .replace(
        'Release: not applicable - docs/process/test-only change',
        'Release: major - planned protocol graduation',
      )
      .replace(
        '- Not applicable - this change does not produce a release entry.',
        'BEGIN_COMMIT_OVERRIDE\nrefactor: consolidate the lifecycle engine\n\nRelease-As: 2.0.0\nEND_COMMIT_OVERRIDE',
      )

    expect(
      validatePrBodyPolicy({
        body,
        changedFiles: ['src/cli.ts'],
        title: 'chore(release): graduate lifecycle engine',
      }),
    ).toEqual([])
  })
})
