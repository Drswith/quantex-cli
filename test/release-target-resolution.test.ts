import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateReleaseIdentity } from '../scripts/release-seal-contract.js'
import {
  classifyCommitReleaseIntent,
  resolveReleaseBranch,
  selectReleasePreparation,
  type SuccessfulCiRun,
} from '../scripts/release-target-resolution.js'
import { extractReleaseNotes } from '../scripts/stage-release-candidate.js'

const prepareWorkflow = readFileSync('.github/workflows/prepare-release.yml', 'utf8')
const sealWorkflow = readFileSync('.github/workflows/seal-release.yml', 'utf8')
const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8')

function run(databaseId: number, headSha: string, updatedAt: string): SuccessfulCiRun {
  return { databaseId, headSha, updatedAt }
}

describe('release preparation resolution', () => {
  it('recognizes release-worthy commits and Release-As metadata', () => {
    expect(classifyCommitReleaseIntent('fix(update): close candidate race').isReleaseWorthy).toBe(true)
    expect(
      classifyCommitReleaseIntent('chore(release): graduate release line\n\nRelease-As: 2.0.0').isReleaseWorthy,
    ).toBe(true)
    expect(classifyCommitReleaseIntent('docs: clarify release recovery').isReleaseWorthy).toBe(false)
  })

  it('selects only Release PR preparation from successful history', () => {
    const resolution = selectReleasePreparation({
      commitsBySha: {
        docs: classifyCommitReleaseIntent('docs: clarify release recovery'),
        fix: classifyCommitReleaseIntent('fix(release): seal the exact candidate'),
      },
      runs: [run(20, 'docs', '2026-08-03T10:10:00Z'), run(10, 'fix', '2026-08-03T10:00:00Z')],
    })

    expect(resolution).toMatchObject({ mode: 'pr', sourceCiRunId: 10, targetSha: 'fix' })
    expect(JSON.stringify(resolution)).not.toContain('publish')
  })

  it('skips when no successful release-worthy commit exists', () => {
    const resolution = selectReleasePreparation({
      commitsBySha: { docs: classifyCommitReleaseIntent('docs: clarify release recovery') },
      runs: [run(20, 'docs', '2026-08-03T10:10:00Z')],
    })
    expect(resolution).toMatchObject({ mode: 'skip', sourceCiRunId: null, targetSha: null })
  })

  it('rejects release preparation outside the protected-branch allowlist', () => {
    expect(resolveReleaseBranch('main')).toEqual({ configFile: 'release-please-config.json', targetBranch: 'main' })
    expect(resolveReleaseBranch('beta')).toEqual({
      configFile: 'release-please-config.beta.json',
      targetBranch: 'beta',
    })
    expect(() => resolveReleaseBranch('codex/feature')).toThrow(/Expected main or beta/)
  })
})

describe('immutable release identity', () => {
  const stableIdentity = {
    branchContainsSha: true,
    branchHeadSha: 'a'.repeat(40),
    ciSha: 'a'.repeat(40),
    commitSha: 'a'.repeat(40),
    commitTitle: 'chore: release 1.8.0',
    mode: 'seal' as const,
    packageVersion: '1.8.0',
    requestedBranch: 'main',
    requestedTag: 'v1.8.0',
    tagSha: null,
  }

  it('derives the stable publication identity from one exact release commit', () => {
    expect(validateReleaseIdentity(stableIdentity)).toEqual({
      channel: 'stable',
      commitSha: 'a'.repeat(40),
      npmTag: 'latest',
      prerelease: false,
      tag: 'v1.8.0',
      targetBranch: 'main',
      version: '1.8.0',
    })
  })

  it('derives beta only from a prerelease version on beta', () => {
    expect(
      validateReleaseIdentity({
        ...stableIdentity,
        commitTitle: 'chore: release 1.8.0-beta.1',
        packageVersion: '1.8.0-beta.1',
        requestedBranch: 'beta',
        requestedTag: 'v1.8.0-beta.1',
      }),
    ).toMatchObject({ npmTag: 'beta', prerelease: true, targetBranch: 'beta' })
  })

  it('fails closed on stale CI, a moved tag, or a non-head seal', () => {
    expect(() => validateReleaseIdentity({ ...stableIdentity, ciSha: null })).toThrow(/lacks successful/)
    expect(() => validateReleaseIdentity({ ...stableIdentity, tagSha: 'b'.repeat(40) })).toThrow(/points to/)
    expect(() => validateReleaseIdentity({ ...stableIdentity, branchHeadSha: 'b'.repeat(40) })).toThrow(
      /exact main head/,
    )
  })

  it('rejects deferred stable v2 sealing', () => {
    expect(() =>
      validateReleaseIdentity({
        ...stableIdentity,
        commitTitle: 'chore: release 2.0.0',
        packageVersion: '2.0.0',
        requestedTag: 'v2.0.0',
      }),
    ).toThrow(/Stable 2.x releases are deferred/)
  })

  it('requires publication to use an existing tag at the candidate SHA', () => {
    expect(() => validateReleaseIdentity({ ...stableIdentity, mode: 'publish' })).toThrow(/Publication requires/)
    expect(
      validateReleaseIdentity({
        ...stableIdentity,
        branchHeadSha: 'b'.repeat(40),
        mode: 'publish',
        tagSha: stableIdentity.commitSha,
      }),
    ).toMatchObject({ tag: 'v1.8.0', version: '1.8.0' })
  })
})

describe('release candidate notes', () => {
  it('extracts only the exact changelog version section', () => {
    const changelog =
      '# Changelog\n\n## [1.8.0](url) (2026-08-03)\n\n### Fixes\n\n- sealed\n\n## [1.7.1](url)\n\n- old\n'
    expect(extractReleaseNotes(changelog, '1.8.0')).toBe('## [1.8.0](url) (2026-08-03)\n\n### Fixes\n\n- sealed\n')
    expect(() => extractReleaseNotes(changelog, '2.0.0')).toThrow(/no release section/)
  })
})

describe('release workflow closure', () => {
  it('keeps preparation branch-scoped and non-publishing', () => {
    expect(prepareWorkflow).toContain('options:\n          - main\n          - beta')
    expect(prepareWorkflow).toContain('bun run scripts/release-target-resolution.ts')
    expect(prepareWorkflow).toContain(
      'googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0',
    )
    expect(prepareWorkflow).toContain('skip-github-release: true')
    expect(prepareWorkflow).toContain('app-id: ${{ secrets.RELEASE_APP_ID }}')
    expect(prepareWorkflow).not.toContain('client-id:')
    expect(prepareWorkflow).not.toContain('npm publish')
    expect(prepareWorkflow).not.toContain('gh release')
  })

  it('seals the exact branch head and explicitly dispatches its tag', () => {
    const identityNameIndex = sealWorkflow.indexOf('git config user.name "github-actions[bot]"')
    const identityEmailIndex = sealWorkflow.indexOf(
      'git config user.email "41898282+github-actions[bot]@users.noreply.github.com"',
    )
    const tagCreationIndex = sealWorkflow.indexOf('git tag --annotate "${RELEASE_TAG}" "${RELEASE_SHA}"')

    expect(sealWorkflow).toContain('bun run scripts/release-seal-contract.ts seal')
    expect(identityNameIndex).toBeGreaterThan(-1)
    expect(identityEmailIndex).toBeGreaterThan(identityNameIndex)
    expect(tagCreationIndex).toBeGreaterThan(identityEmailIndex)
    expect(sealWorkflow).toContain('gh workflow run release.yml --ref "${RELEASE_TAG}"')
    expect(sealWorkflow).not.toContain('npm publish')
  })

  it('builds one candidate artifact and promotes it without checkout or rebuild', () => {
    const publishJob = releaseWorkflow.slice(releaseWorkflow.indexOf('  publish:'))
    expect(releaseWorkflow).toContain("tags:\n      - 'v*'")
    expect(releaseWorkflow).toContain('bun run scripts/release-seal-contract.ts publish')
    expect(releaseWorkflow).toContain('actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1')
    expect(publishJob).toContain('actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1')
    expect(publishJob).toContain('GH_REPO: ${{ github.repository }}')
    expect(publishJob).not.toContain('actions/checkout')
    expect(publishJob).not.toContain('bun run build')
    expect(publishJob).not.toContain('npm pack')
    expect(publishJob).toContain('npm publish release-candidate/npm/*.tgz')
    expect(releaseWorkflow).toContain('bun run scripts/verify-package-distribution.ts release-candidate/npm/*.tgz')
  })

  it('stages and verifies GitHub assets before npm and publishes the release last', () => {
    const draftIndex = releaseWorkflow.indexOf('Create or recover draft GitHub Release')
    const assetVerifyIndex = releaseWorkflow.indexOf('Verify staged GitHub Release assets')
    const npmPublishIndex = releaseWorkflow.indexOf('Publish exact CLI candidate tarball')
    const npmVerifyIndex = releaseWorkflow.indexOf('Verify npm registry closure')
    const releasePublishIndex = releaseWorkflow.indexOf('Publish recovered GitHub Release')

    expect(draftIndex).toBeGreaterThan(-1)
    expect(assetVerifyIndex).toBeGreaterThan(draftIndex)
    expect(npmPublishIndex).toBeGreaterThan(assetVerifyIndex)
    expect(npmVerifyIndex).toBeGreaterThan(npmPublishIndex)
    expect(releasePublishIndex).toBeGreaterThan(npmVerifyIndex)
    expect(releaseWorkflow).not.toContain('release-please-action')
    expect(releaseWorkflow).not.toContain('sync-quantex-cli-release')
    expect(releaseWorkflow).not.toContain('npm publish ./packages/core')
  })
})
