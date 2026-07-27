import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  classifyCommitReleaseIntent,
  classifyNpmReleaseIntegrity,
  selectReleaseCandidate,
  type CommitReleaseIntent,
  type NpmPackagePublicationStatus,
  type NpmReleasePublicationState,
  type SuccessfulCiRun,
} from '../scripts/release-target-resolution.js'

const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8')
const releaseVerifyWorkflow = readFileSync('.github/workflows/release-verify.yml', 'utf8')

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

describe('release target resolution', () => {
  it('recognizes the exact graduation commit subject as release-worthy while preserving Release-As metadata', () => {
    const intent = commit('feat(release)!: graduate post-redesign line\n\nRelease-As: 1.1.0')
    const resolution = selectReleaseCandidate({
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
    const resolution = selectReleaseCandidate({
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
    const resolution = selectReleaseCandidate({
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
    const resolution = selectReleaseCandidate({
      commitsBySha: {
        rel235: commit('chore: release 0.23.5'),
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
    const resolution = selectReleaseCandidate({
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
    const resolution = selectReleaseCandidate({
      commitsBySha: {
        rel235: commit('chore: release 0.23.5'),
        rel172: commit('chore: release 0.17.2'),
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
    const resolution = selectReleaseCandidate({
      commitsBySha: {
        rel113: commit('chore: release 1.1.3'),
        fixNext: commit('fix(cli): preserve the compatibility shell'),
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

  it('falls back to release PR mode when no untagged release commit is pending', () => {
    const resolution = selectReleaseCandidate({
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
    const resolution = selectReleaseCandidate({
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
      selectReleaseCandidate({
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
    const resolution = selectReleaseCandidate({
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
      selectReleaseCandidate({
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
      selectReleaseCandidate({
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
  it('pins Bun and preserves main and beta as the only release branches', () => {
    expect(releaseWorkflow).toContain('bun-version: 1.3.11')
    expect(releaseVerifyWorkflow).toContain('bun-version: 1.3.11')
    expect(releaseWorkflow).toContain('branches:\n      - main\n      - beta')
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
})
