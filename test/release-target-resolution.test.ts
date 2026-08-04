import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateReleaseIdentity } from '../scripts/release-seal-contract.js'
import { extractReleaseNotes } from '../scripts/stage-release-candidate.js'

const releasePleaseWorkflow = readFileSync('.github/workflows/release-please.yml', 'utf8')
const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8')

describe('immutable release identity', () => {
  const stableIdentity = {
    branchContainsSha: true,
    branchHeadSha: 'a'.repeat(40),
    ciSha: 'a'.repeat(40),
    commitSha: 'a'.repeat(40),
    commitTitle: 'chore: release 1.8.0',
    packageVersion: '1.8.0',
    requestedBranch: 'main',
    requestedTag: 'v1.8.0',
    tagSha: 'a'.repeat(40),
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

  it('fails closed on a moved tag, stale CI, or non-head publication', () => {
    expect(() => validateReleaseIdentity({ ...stableIdentity, tagSha: 'b'.repeat(40) })).toThrow(/Publication requires/)
    expect(() => validateReleaseIdentity({ ...stableIdentity, branchContainsSha: false })).toThrow(/not reachable/)
    expect(() => validateReleaseIdentity({ ...stableIdentity, ciSha: null })).toThrow(/lacks successful/)
    expect(() => validateReleaseIdentity({ ...stableIdentity, branchHeadSha: 'b'.repeat(40) })).toThrow(
      /exact main head/,
    )
  })

  it('requires publication to use an existing tag at the candidate SHA', () => {
    expect(() => validateReleaseIdentity({ ...stableIdentity, tagSha: null })).toThrow(/Publication requires/)
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
  it('opens Release PRs automatically on protected-branch push', () => {
    expect(releasePleaseWorkflow).toContain('branches:\n      - main\n      - beta')
    expect(releasePleaseWorkflow).toContain('skip-github-release: true')
    expect(releasePleaseWorkflow).toContain(
      'googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0',
    )
    expect(releasePleaseWorkflow).toContain('app-id: ${{ secrets.RELEASE_APP_ID }}')
    expect(releasePleaseWorkflow).not.toContain('npm publish')
  })

  it('builds one candidate artifact and promotes it without rebuild', () => {
    const publishJob = releaseWorkflow.slice(releaseWorkflow.indexOf('  publish:'))
    const releaseCandidateScript = readFileSync('scripts/release-candidate.ts', 'utf8')
    expect(releaseWorkflow).toContain("tags:\n      - 'v*'")
    expect(releaseWorkflow).toContain('bun run release:candidate')
    expect(releaseCandidateScript).toContain('ci:release-publish-contract')
    expect(releaseCandidateScript).toContain('verify-package-distribution.ts')
    expect(releaseWorkflow).toContain('actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1')
    expect(publishJob).toContain('actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1')
    expect(publishJob).toContain('GH_REPO: ${{ github.repository }}')
    expect(publishJob).not.toContain('bun run build')
    expect(publishJob).not.toContain('npm pack')
    expect(publishJob).toContain('npm publish release-candidate/npm/*.tgz')
    expect(releaseWorkflow).not.toContain('bun run test')
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
  })
})
