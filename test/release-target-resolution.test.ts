import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  classifyCommitReleaseIntent,
  classifyGithubReleaseAssetIntegrity,
  classifyNpmReleaseIntegrity,
  REQUIRED_GITHUB_RELEASE_ASSET_NAMES,
  selectReleaseCandidate,
  type CommitReleaseIntent,
  type GithubReleaseAssetState,
  type GithubReleaseAssetStatus,
  type NpmPackagePublicationStatus,
  type NpmReleasePublicationState,
  type SelectReleaseCandidateOptions,
  type SuccessfulCiRun,
} from '../scripts/release-target-resolution.js'

const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8')

function commit(message: string): CommitReleaseIntent {
  return classifyCommitReleaseIntent(message)
}

function run(databaseId: number, headSha: string, updatedAt: string): SuccessfulCiRun {
  return {
    databaseId,
    headSha,
    updatedAt,
  }
}

function npmPublication(cli: NpmPackagePublicationStatus, detail?: string): NpmReleasePublicationState {
  return {
    'quantex-cli': { detail: cli === 'indeterminate' ? detail : undefined, status: cli },
  }
}

function assetState(status: GithubReleaseAssetStatus, detail?: string): GithubReleaseAssetState {
  return { detail, status }
}

function resolve(
  options: Omit<SelectReleaseCandidateOptions, 'githubReleaseAssetsByVersion'> & {
    githubReleaseAssetsByVersion?: Record<string, GithubReleaseAssetState>
  },
) {
  return selectReleaseCandidate({
    githubReleaseAssetsByVersion: {},
    ...options,
  })
}

describe('release target resolution', () => {
  it('recognizes the exact graduation commit subject as release-worthy while preserving Release-As metadata', () => {
    const intent = commit('feat(release)!: graduate post-redesign line\n\nRelease-As: 1.1.0')
    const resolution = resolve({
      commitsBySha: { graduation: intent },
      npmPublicationsByVersion: {},
      publishedReleaseShas: new Set<string>(),
      publishedTags: new Set<string>(),
      runs: [run(10, 'graduation', '2026-07-16T12:00:00Z')],
    })

    expect(intent.firstLine).toBe('feat(release)!: graduate post-redesign line')
    expect(intent.isReleaseWorthy).toBe(true)
    expect(intent.isReleaseCommit).toBe(false)
    expect(resolution.mode).toBe('pr')
    expect(resolution.targetSha).toBe('graduation')
  })

  it('recognizes Release-As metadata on a neutral commit as release-worthy resolver input', () => {
    expect(commit('chore(release): graduate post-redesign line\n\nRelease-As: 2.0.0').isReleaseWorthy).toBe(true)
  })

  it('keeps neutral commits without Release-As out of release reconciliation', () => {
    expect(commit('chore(release): prepare release governance').isReleaseWorthy).toBe(false)
  })

  it('publishes a pending untagged release commit before creating another release PR', () => {
    const resolution = resolve({
      commitsBySha: {
        docs999: commit('docs: sync runbook wording'),
        rel123: commit('chore: release 0.16.4'),
        fix111: commit('fix(lock): close owner-less acquisition race'),
      },
      npmPublicationsByVersion: {
        '0.16.4': npmPublication('missing'),
      },
      publishedReleaseShas: new Set<string>(),
      publishedTags: new Set<string>(),
      runs: [
        run(30, 'docs999', '2026-05-09T07:10:00Z'),
        run(20, 'rel123', '2026-05-09T07:05:00Z'),
        run(10, 'fix111', '2026-05-09T07:00:00Z'),
      ],
    })

    expect(resolution.mode).toBe('publish')
    expect(resolution.targetSha).toBe('rel123')
    expect(resolution.targetTag).toBe('v0.16.4')
    expect(resolution.reason).toContain('pending untagged release commit 0.16.4')
  })

  it('publishes a release commit when the CLI package is missing', () => {
    const resolution = resolve({
      commitsBySha: {
        rel235: commit('chore: release 0.23.5'),
        fix111: commit('fix(cli): harden idempotency target matching'),
      },
      npmPublicationsByVersion: {
        '0.23.5': npmPublication('missing'),
      },
      publishedReleaseShas: new Set<string>(['rel235']),
      publishedTags: new Set<string>(['v0.23.5']),
      runs: [run(20, 'rel235', '2026-06-11T03:45:00Z'), run(10, 'fix111', '2026-06-11T03:40:00Z')],
    })

    expect(resolution.mode).toBe('publish')
    expect(resolution.targetSha).toBe('rel235')
    expect(resolution.targetTag).toBe('v0.23.5')
    expect(resolution.npmIntegrity).toBe('cli-missing')
    expect(resolution.reason).toContain('quantex-cli is missing')
  })

  it('does not reopen CLI closure when the private Core package is absent from npm', () => {
    const resolution = resolve({
      commitsBySha: {
        rel235: commit('chore: release 0.23.5'),
      },
      githubReleaseAssetsByVersion: {
        '0.23.5': assetState('complete'),
      },
      npmPublicationsByVersion: {
        '0.23.5': npmPublication('published'),
      },
      publishedReleaseShas: new Set<string>(['rel235']),
      publishedTags: new Set<string>(['v0.23.5']),
      runs: [run(20, 'rel235', '2026-06-11T03:45:00Z')],
    })

    expect(resolution.mode).toBe('skip')
    expect(resolution.npmIntegrity).toBe('cli-published')
  })

  it('represents the primary CLI package missing at the release version', () => {
    const resolution = resolve({
      commitsBySha: {
        rel235: commit('chore: release 0.23.5'),
      },
      npmPublicationsByVersion: {
        '0.23.5': npmPublication('missing'),
      },
      publishedReleaseShas: new Set<string>(['rel235']),
      publishedTags: new Set<string>(['v0.23.5']),
      runs: [run(20, 'rel235', '2026-06-11T03:45:00Z')],
    })

    expect(resolution.mode).toBe('publish')
    expect(resolution.npmIntegrity).toBe('cli-missing')
    expect(resolution.reason).toContain('quantex-cli is missing')
  })

  it('does not backfill older npm-missing release commits when the latest release is already on npm', () => {
    const resolution = resolve({
      commitsBySha: {
        rel235: commit('chore: release 0.23.5'),
        rel172: commit('chore: release 0.17.2'),
      },
      githubReleaseAssetsByVersion: {
        '0.23.5': assetState('complete'),
        '0.17.2': assetState('incomplete'),
      },
      npmPublicationsByVersion: {
        '0.23.5': npmPublication('published'),
        '0.17.2': npmPublication('missing'),
      },
      publishedReleaseShas: new Set<string>(['rel235', 'rel172']),
      publishedTags: new Set<string>(['v0.23.5', 'v0.17.2']),
      runs: [run(20, 'rel235', '2026-06-11T03:45:00Z'), run(10, 'rel172', '2026-05-16T03:00:00Z')],
    })

    expect(resolution.mode).toBe('skip')
    expect(resolution.npmIntegrity).toBe('cli-published')
    expect(resolution.targetSha).toBeNull()
  })

  it('uses the same CLI-only closure for releases before and after the Core workspace existed', () => {
    const resolution = resolve({
      commitsBySha: {
        rel113: commit('chore: release 1.1.3'),
        fixNext: commit('fix(cli): preserve the compatibility shell'),
      },
      githubReleaseAssetsByVersion: {
        '1.1.3': assetState('complete'),
      },
      npmPublicationsByVersion: {
        '1.1.3': {
          'quantex-cli': { status: 'published' },
        },
      },
      publishedReleaseShas: new Set<string>(['rel113']),
      publishedTags: new Set<string>(['v1.1.3']),
      runs: [run(20, 'rel113', '2026-07-20T03:45:00Z'), run(10, 'fixNext', '2026-07-20T03:40:00Z')],
    })

    expect(resolution.mode).toBe('pr')
    expect(resolution.npmIntegrity).toBe('cli-published')
  })

  it('publishes when npm is present but GitHub Release assets are incomplete', () => {
    const resolution = resolve({
      commitsBySha: {
        rel130: commit('chore: release 1.3.0'),
        fixNext: commit('fix(cli): harden release recovery'),
      },
      githubReleaseAssetsByVersion: {
        '1.3.0': assetState('incomplete', 'missing quantex-linux-x64'),
      },
      npmPublicationsByVersion: {
        '1.3.0': npmPublication('published'),
      },
      publishedReleaseShas: new Set<string>(['rel130']),
      publishedTags: new Set<string>(['v1.3.0']),
      runs: [run(20, 'rel130', '2026-07-27T06:00:00Z'), run(10, 'fixNext', '2026-07-27T05:50:00Z')],
    })

    expect(resolution.mode).toBe('publish')
    expect(resolution.targetSha).toBe('rel130')
    expect(resolution.targetTag).toBe('v1.3.0')
    expect(resolution.npmIntegrity).toBe('cli-published')
    expect(resolution.reason).toContain('GitHub Release assets are incomplete')
  })

  it('fails closed when GitHub Release asset inspection is indeterminate', () => {
    expect(() =>
      resolve({
        commitsBySha: {
          rel130: commit('chore: release 1.3.0'),
        },
        githubReleaseAssetsByVersion: {
          '1.3.0': assetState('indeterminate', 'HTTP 503 Service Unavailable'),
        },
        npmPublicationsByVersion: {
          '1.3.0': npmPublication('published'),
        },
        publishedReleaseShas: new Set<string>(['rel130']),
        publishedTags: new Set<string>(['v1.3.0']),
        runs: [run(20, 'rel130', '2026-07-27T06:00:00Z')],
      }),
    ).toThrow(/GitHub Release asset integrity[\s\S]*HTTP 503 Service Unavailable[\s\S]*fails closed/)
  })

  it('fails closed when a published release has no asset inspection result', () => {
    expect(() =>
      resolve({
        commitsBySha: {
          rel130: commit('chore: release 1.3.0'),
        },
        npmPublicationsByVersion: {
          '1.3.0': npmPublication('published'),
        },
        publishedReleaseShas: new Set<string>(['rel130']),
        publishedTags: new Set<string>(['v1.3.0']),
        runs: [run(20, 'rel130', '2026-07-27T06:00:00Z')],
      }),
    ).toThrow(/no asset inspection result[\s\S]*fails closed/)
  })

  it('classifies the required GitHub Release asset matrix', () => {
    expect(classifyGithubReleaseAssetIntegrity(REQUIRED_GITHUB_RELEASE_ASSET_NAMES)).toBe('complete')
    expect(classifyGithubReleaseAssetIntegrity(REQUIRED_GITHUB_RELEASE_ASSET_NAMES.slice(0, -1))).toBe('incomplete')
    expect(classifyGithubReleaseAssetIntegrity([])).toBe('incomplete')
  })

  it('falls back to release PR mode when no untagged release commit is pending', () => {
    const resolution = resolve({
      commitsBySha: {
        docs999: commit('docs: sync runbook wording'),
        fix111: commit('fix(lock): close owner-less acquisition race'),
      },
      npmPublicationsByVersion: {},
      publishedReleaseShas: new Set<string>(),
      publishedTags: new Set<string>(),
      runs: [run(30, 'docs999', '2026-05-09T07:10:00Z'), run(10, 'fix111', '2026-05-09T07:00:00Z')],
    })

    expect(resolution.mode).toBe('pr')
    expect(resolution.targetSha).toBe('fix111')
  })

  it('skips when no successful release-worthy commit exists', () => {
    const resolution = resolve({
      commitsBySha: {
        docs999: commit('docs: sync runbook wording'),
        chore111: commit('chore: archive openspec deltas'),
      },
      npmPublicationsByVersion: {},
      publishedReleaseShas: new Set<string>(),
      publishedTags: new Set<string>(),
      runs: [run(30, 'docs999', '2026-05-09T07:10:00Z'), run(10, 'chore111', '2026-05-09T07:00:00Z')],
    })

    expect(resolution.mode).toBe('skip')
    expect(resolution.targetSha).toBeNull()
  })

  it('fails closed when more than one untagged release commit is pending', () => {
    expect(() =>
      resolve({
        commitsBySha: {
          rel200: commit('chore: release 0.16.5'),
          rel100: commit('chore: release 0.16.4'),
        },
        npmPublicationsByVersion: {
          '0.16.4': npmPublication('missing'),
          '0.16.5': npmPublication('missing'),
        },
        publishedReleaseShas: new Set<string>(),
        publishedTags: new Set<string>(),
        runs: [run(20, 'rel200', '2026-05-09T07:10:00Z'), run(10, 'rel100', '2026-05-09T07:00:00Z')],
      }),
    ).toThrow(/Multiple successful untagged release commits/)
  })

  it('does not treat a tagged release commit as pending when its title version is stale', () => {
    const resolution = resolve({
      commitsBySha: {
        rel164: commit('chore: release 0.16.4'),
        rel060: commit('chore: release 0.5.1'),
      },
      npmPublicationsByVersion: {
        '0.16.4': npmPublication('missing'),
        '0.5.1': npmPublication('published'),
      },
      publishedReleaseShas: new Set<string>(['rel060']),
      publishedTags: new Set<string>(),
      runs: [run(20, 'rel164', '2026-05-09T07:10:00Z'), run(10, 'rel060', '2026-04-29T19:00:00Z')],
    })

    expect(resolution.mode).toBe('publish')
    expect(resolution.targetSha).toBe('rel164')
    expect(resolution.reason).toContain('pending untagged release commit 0.16.4')
  })

  it('fails closed when the CLI registry result is indeterminate', () => {
    expect(classifyNpmReleaseIntegrity(npmPublication('indeterminate', 'HTTP 503 Service Unavailable'))).toBe(
      'registry-indeterminate',
    )

    expect(() =>
      resolve({
        commitsBySha: {
          rel235: commit('chore: release 0.23.5'),
        },
        npmPublicationsByVersion: {
          '0.23.5': npmPublication('indeterminate', 'HTTP 503 Service Unavailable'),
        },
        publishedReleaseShas: new Set<string>(['rel235']),
        publishedTags: new Set<string>(['v0.23.5']),
        runs: [run(20, 'rel235', '2026-06-11T03:45:00Z')],
      }),
    ).toThrow(/quantex-cli: HTTP 503 Service Unavailable[\s\S]*fails closed/)
  })

  it('fails closed when a release commit has no registry inspection result', () => {
    expect(() =>
      resolve({
        commitsBySha: {
          rel235: commit('chore: release 0.23.5'),
        },
        npmPublicationsByVersion: {},
        publishedReleaseShas: new Set<string>(['rel235']),
        publishedTags: new Set<string>(['v0.23.5']),
        runs: [run(20, 'rel235', '2026-06-11T03:45:00Z')],
      }),
    ).toThrow(/no registry inspection result[\s\S]*fails closed/)
  })
})

describe('release workflow package closure', () => {
  it('pins Bun and keeps release dispatch scoped to main and beta', () => {
    expect(releaseWorkflow).toContain('bun-version: 1.3.11')
    expect(releaseWorkflow).toContain('options:\n          - main\n          - beta')
  })

  it('keeps private Core publication out of the primary release workflow', () => {
    const cliPublishIndex = releaseWorkflow.indexOf('npm publish . --access')

    expect(cliPublishIndex).toBeGreaterThan(-1)
    expect(releaseWorkflow).toContain('bun run package:check')
    expect(releaseWorkflow).not.toContain('npm publish ./packages/core')
    expect(releaseWorkflow).not.toContain('npm view "@quantex/core')
    expect(releaseWorkflow).not.toContain('CORE_NPM_TRUSTED_PUBLISHING_READY')
    expect(releaseWorkflow).not.toContain('core_required')
  })

  it('inspects and verifies CLI before creating the GitHub Release and uploading artifacts', () => {
    const inspectIndex = releaseWorkflow.indexOf('npm view "${package_name}@${release_version}" version --json')
    const cliPublishIndex = releaseWorkflow.indexOf('npm publish . --access')
    const cliVerifyIndex = releaseWorkflow.indexOf('verify_package_version "quantex-cli"')
    const githubReleaseIndex = releaseWorkflow.indexOf('- name: Release Please GitHub Release')
    const uploadIndex = releaseWorkflow.indexOf('gh release upload')

    expect(inspectIndex).toBeGreaterThan(-1)
    expect(releaseWorkflow).toContain("steps.npm-publication.outputs.cli_published != 'true'")
    expect(cliPublishIndex).toBeGreaterThan(inspectIndex)
    expect(cliVerifyIndex).toBeGreaterThan(cliPublishIndex)
    expect(githubReleaseIndex).toBeGreaterThan(cliVerifyIndex)
    expect(uploadIndex).toBeGreaterThan(githubReleaseIndex)
    expect(releaseWorkflow).not.toContain('sync-quantex-cli-release')
    expect(releaseWorkflow).not.toContain('QUANTEX_SYNC_TOKEN')
  })

  it('uses one immutable release source without a cross-branch compatibility fallback', () => {
    const releasedSourceIndex = releaseWorkflow.indexOf('- name: Checkout released source')

    expect(releasedSourceIndex).toBeGreaterThan(-1)
    expect(releaseWorkflow).not.toContain('RELEASE_CONTROL_SOURCE_DIR')
    expect(releaseWorkflow).not.toContain('N_MINUS_ONE_SOURCE_DIR')
    expect(releaseWorkflow).not.toContain('compat:n-minus-one')
  })
})
