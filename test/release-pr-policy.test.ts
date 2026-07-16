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

  it('accepts a pre-1.0 breaking-change minor release', () => {
    expect(
      validateReleasePrPolicy({
        baseBranch: 'main',
        baseVersion: '0.21.1',
        body: validBody,
        changedFiles: validChangedFiles,
        headBranch: 'release-please--branches--main--components--quantex-cli',
        title: 'chore: release 0.22.0',
      }),
    ).toEqual([])
  })

  it('rejects accidental pre-1.0 promotion to 1.0.0', () => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'main',
      baseVersion: '0.21.1',
      body: validBody,
      changedFiles: validChangedFiles,
      headBranch: 'release-please--branches--main--components--quantex-cli',
      title: 'chore: release 1.0.0',
    })

    expect(issues.join('\n')).toContain('would promote the main release line from "0.21.1" to 1.0.0')
  })

  it('rejects burned stable release version 1.0.0 even outside zero-major promotion', () => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'main',
      baseVersion: '0.99.0',
      body: validBody,
      changedFiles: validChangedFiles,
      headBranch: 'release-please--branches--main--components--quantex-cli',
      title: 'chore: release 1.0.0',
    })

    expect(issues.join('\n')).toContain('version "1.0.0" is a burned stable release version')
  })

  it('accepts the exact post-redesign graduation from 0.29.1 to 1.1.0', () => {
    expect(
      validateReleasePrPolicy({
        baseBranch: 'main',
        baseVersion: '0.29.1',
        body: validBody,
        changedFiles: validChangedFiles,
        headBranch: 'release-please--branches--main--components--quantex-cli',
        title: 'chore: release 1.1.0',
      }),
    ).toEqual([])
  })

  it.each(['0.29.2', '0.30.0'])('rejects later zero-major release %s after final baseline 0.29.1', proposed => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'main',
      baseVersion: '0.29.1',
      body: validBody,
      changedFiles: validChangedFiles,
      headBranch: 'release-please--branches--main--components--quantex-cli',
      title: `chore: release ${proposed}`,
    })

    expect(issues.join('\n')).toContain('0.29.1 is the final stable 0.x release')
  })

  it('rejects 1.1.0 graduation from the wrong zero-major base', () => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'main',
      baseVersion: '0.28.0',
      body: validBody,
      changedFiles: validChangedFiles,
      headBranch: 'release-please--branches--main--components--quantex-cli',
      title: 'chore: release 1.1.0',
    })

    expect(issues.join('\n')).toContain('only allowed stable graduation is "0.29.1" to "1.1.0"')
  })

  it('rejects a different 1.x graduation target from 0.29.1', () => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'main',
      baseVersion: '0.29.1',
      body: validBody,
      changedFiles: validChangedFiles,
      headBranch: 'release-please--branches--main--components--quantex-cli',
      title: 'chore: release 1.2.0',
    })

    expect(issues.join('\n')).toContain('only allowed stable graduation is "0.29.1" to "1.1.0"')
  })

  it('allows post-1.0 stable releases to advance normally', () => {
    expect(
      validateReleasePrPolicy({
        baseBranch: 'main',
        baseVersion: '1.1.0',
        body: validBody,
        changedFiles: validChangedFiles,
        headBranch: 'release-please--branches--main--components--quantex-cli',
        title: 'chore: release 1.1.1',
      }),
    ).toEqual([])
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
