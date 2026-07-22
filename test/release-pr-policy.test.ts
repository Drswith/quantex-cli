import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  compareReleaseVersions,
  validateReleasePrPolicy as validateReleasePrPolicyImplementation,
} from '../scripts/release-pr-policy.js'

type ReleasePrPolicyInput = Parameters<typeof validateReleasePrPolicyImplementation>[0]
type TestReleasePrPolicyInput = Omit<ReleasePrPolicyInput, 'coreManifest' | 'rootManifest'> &
  Partial<Pick<ReleasePrPolicyInput, 'coreManifest' | 'rootManifest'>>

const stableReleaseConfig = JSON.parse(readFileSync('release-please-config.json', 'utf8'))
const betaReleaseConfig = JSON.parse(readFileSync('release-please-config.beta.json', 'utf8'))

const validBody = `## Summary

- materialize the next Quantex release version in source-controlled files

---
This PR was generated with [Release Please](https://github.com/googleapis/release-please).
`

const validChangedFiles = [
  '.release-please-manifest.json',
  'CHANGELOG.md',
  'package.json',
  'packages/core/package.json',
  'src/generated/build-meta.ts',
]

function validateReleasePrPolicy(input: TestReleasePrPolicyInput): string[] {
  const proposedVersion = input.title.match(/\d+\.\d+\.\d+(?:-beta(?:\.\d+)?)?/)?.[0] ?? input.baseVersion

  return validateReleasePrPolicyImplementation({
    ...input,
    coreManifest: input.coreManifest ?? {
      version: proposedVersion,
    },
    rootManifest: input.rootManifest ?? {
      version: proposedVersion,
      devDependencies: {
        '@quantex/core': proposedVersion,
      },
    },
  })
}

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

  it('accepts a valid beta release PR with synchronized manifests', () => {
    expect(
      validateReleasePrPolicy({
        baseBranch: 'beta',
        baseVersion: '1.2.0-beta.1',
        body: validBody,
        changedFiles: validChangedFiles,
        headBranch: 'release-please--branches--beta--components--quantex-cli',
        title: 'chore: release 1.2.0-beta.2',
      }),
    ).toEqual([])
  })

  it('rejects release targets outside main and beta', () => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'codex/simplify-core-sdk-integration',
      baseVersion: '1.1.3',
      body: validBody,
      changedFiles: validChangedFiles,
      headBranch: 'release-please--branches--codex/simplify-core-sdk-integration--components--quantex-cli',
      title: 'chore: release 1.1.4',
    })

    expect(issues.join('\n')).toContain('is not allowed; expected main or beta')
  })

  it('rejects a missing base package version', () => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'main',
      baseVersion: '',
      body: validBody,
      changedFiles: validChangedFiles,
      headBranch: 'release-please--branches--main--components--quantex-cli',
      title: 'chore: release 1.1.4',
    })

    expect(issues.join('\n')).toContain('requires the current base package version')
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

  it('rejects a Release PR that omits the Core manifest version update', () => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'main',
      baseVersion: '1.1.3',
      body: validBody,
      changedFiles: validChangedFiles.filter(fileName => fileName !== 'packages/core/package.json'),
      headBranch: 'release-please--branches--main--components--quantex-cli',
      title: 'chore: release 1.1.4',
    })

    expect(issues.join('\n')).toContain('Release PR is missing required version files: packages/core/package.json')
  })

  it('rejects a root manifest version that differs from the Release PR title', () => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'main',
      baseVersion: '1.1.3',
      body: validBody,
      changedFiles: validChangedFiles,
      headBranch: 'release-please--branches--main--components--quantex-cli',
      rootManifest: {
        version: '1.1.5',
        devDependencies: {
          '@quantex/core': '1.1.4',
        },
      },
      title: 'chore: release 1.1.4',
    })

    expect(issues.join('\n')).toContain('Root package.json version "1.1.5" must equal Release PR title version "1.1.4"')
  })

  it('rejects a Core manifest version that differs from the Release PR title', () => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'main',
      baseVersion: '1.1.3',
      body: validBody,
      changedFiles: validChangedFiles,
      coreManifest: {
        version: '1.1.5',
      },
      headBranch: 'release-please--branches--main--components--quantex-cli',
      title: 'chore: release 1.1.4',
    })

    expect(issues.join('\n')).toContain('Core package.json version "1.1.5" must equal Release PR title version "1.1.4"')
  })

  it('rejects a non-exact Core development dependency version', () => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'main',
      baseVersion: '1.1.3',
      body: validBody,
      changedFiles: validChangedFiles,
      headBranch: 'release-please--branches--main--components--quantex-cli',
      rootManifest: {
        version: '1.1.4',
        devDependencies: {
          '@quantex/core': '^1.1.4',
        },
      },
      title: 'chore: release 1.1.4',
    })

    expect(issues.join('\n')).toContain(
      'Root devDependencies["@quantex/core"] version "^1.1.4" must equal Release PR title version "1.1.4"',
    )
  })

  it('rejects workspace protocols from either publishable manifest', () => {
    const issues = validateReleasePrPolicy({
      baseBranch: 'main',
      baseVersion: '1.1.3',
      body: validBody,
      changedFiles: validChangedFiles,
      coreManifest: {
        version: '1.1.4',
        peerDependencies: {
          'example-core-peer': 'workspace:^',
        },
      },
      headBranch: 'release-please--branches--main--components--quantex-cli',
      rootManifest: {
        version: '1.1.4',
        devDependencies: {
          '@quantex/core': 'workspace:*',
        },
      },
      title: 'chore: release 1.1.4',
    })

    expect(issues.join('\n')).toContain(
      'package.json devDependencies["@quantex/core"] uses forbidden workspace protocol "workspace:*"',
    )
    expect(issues.join('\n')).toContain(
      'packages/core/package.json peerDependencies["example-core-peer"] uses forbidden workspace protocol "workspace:^"',
    )
  })

  it.each([
    ['stable', stableReleaseConfig],
    ['beta', betaReleaseConfig],
  ])('keeps the %s channel on one root release component and synchronizes Core as extra files', (_, config) => {
    expect(Object.keys(config.packages)).toEqual(['.'])
    expect(config.packages['.']['package-name']).toBe('quantex-cli')
    expect(config.packages['.']['include-component-in-tag']).toBe(false)
    expect(config.packages['.']['extra-files']).toEqual([
      'src/generated/build-meta.ts',
      'packages/core/package.json',
      {
        type: 'json',
        path: 'package.json',
        jsonpath: "$.devDependencies['@quantex/core']",
      },
    ])
  })

  it('compares stable releases after beta prereleases', () => {
    expect(compareReleaseVersions('0.14.0', '0.14.0-beta.2')).toBeGreaterThan(0)
    expect(compareReleaseVersions('0.14.0-beta.3', '0.14.0-beta.2')).toBeGreaterThan(0)
  })
})
