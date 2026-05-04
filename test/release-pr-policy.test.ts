import { describe, expect, it } from 'vitest'
import { compareReleaseVersions, validateReleasePrPolicy } from '../scripts/release-pr-policy.js'

const validBody = `## Summary

- materialize the next Quantex release version in source-controlled files

---
This PR was generated with [Release Please](https://github.com/googleapis/release-please).
`

const validChangedFiles = [
  '.release-please-manifest.json',
  'CHANGELOG.md',
  'package.json',
  'src/generated/build-meta.ts',
]

describe('release PR policy', () => {
  it('accepts a valid stable release PR', () => {
    expect(
      validateReleasePrPolicy({
        baseBranch: 'main',
        baseVersion: '0.13.0',
        body: validBody,
        changedFiles: validChangedFiles,
        headBranch: 'release-please--branches--main--components--quantex-cli',
        title: 'chore: release 0.14.0',
      }),
    ).toEqual([])
  })

  it('rejects a duplicate stable release version', () => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'main',
      baseVersion: '0.13.0',
      body: validBody,
      changedFiles: validChangedFiles,
      headBranch: 'release-please--branches--main--components--quantex-cli',
      title: 'chore: release 0.13.0',
    })

    expect(issues.join('\n')).toContain('must be greater than the current main version "0.13.0"')
  })

  it('rejects unexpected file scope', () => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'main',
      baseVersion: '0.13.0',
      body: validBody,
      changedFiles: [...validChangedFiles, 'README.md'],
      headBranch: 'release-please--branches--main--components--quantex-cli',
      title: 'chore: release 0.14.0',
    })

    expect(issues.join('\n')).toContain('Release PR changes unexpected files: README.md')
  })

  it('compares stable releases after beta prereleases', () => {
    expect(compareReleaseVersions('0.14.0', '0.14.0-beta.2')).toBeGreaterThan(0)
    expect(compareReleaseVersions('0.14.0-beta.3', '0.14.0-beta.2')).toBeGreaterThan(0)
  })
})
