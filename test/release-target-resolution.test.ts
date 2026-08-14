import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateReleaseIdentity } from '../scripts/release/release-seal-contract.js'
import { extractReleaseNotes } from '../scripts/release/stage-release-candidate.js'

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

  it('derives the beta dist-tag from a prerelease cut on main', () => {
    expect(
      validateReleaseIdentity({
        ...stableIdentity,
        commitTitle: 'chore: release 1.9.0-beta.1',
        packageVersion: '1.9.0-beta.1',
        requestedTag: 'v1.9.0-beta.1',
      }),
    ).toMatchObject({ channel: 'beta', npmTag: 'beta', prerelease: true, targetBranch: 'main' })
  })

  it('refuses to publish any release from a branch other than main', () => {
    expect(() => validateReleaseIdentity({ ...stableIdentity, requestedBranch: 'beta' })).toThrow(
      /must be published from main/,
    )
  })

  it('fails closed on a moved tag, stale CI, or unreachable commit', () => {
    expect(() => validateReleaseIdentity({ ...stableIdentity, tagSha: 'b'.repeat(40) })).toThrow(/Publication requires/)
    expect(() => validateReleaseIdentity({ ...stableIdentity, branchContainsSha: false })).toThrow(/not reachable/)
    expect(() => validateReleaseIdentity({ ...stableIdentity, ciSha: null })).toThrow(/lacks successful/)
  })

  it('requires publication to use an existing tag at the candidate SHA', () => {
    expect(() => validateReleaseIdentity({ ...stableIdentity, tagSha: null })).toThrow(/Publication requires/)
  })

  // A squash merge appends " (#NNN)" to the release commit title. Treating that
  // as a title mismatch blocked v1.8.3 through v1.8.5 before the suffix was
  // normalized, so keep every accepted and rejected shape covered.
  it.each([
    ['squash merge suffix', 'chore: release 1.8.0 (#580)'],
    ['squash merge suffix with padding', 'chore: release 1.8.0  (#1234)  '],
    ['no suffix', 'chore: release 1.8.0'],
  ])('accepts a release commit title with a %s', (_, commitTitle) => {
    expect(validateReleaseIdentity({ ...stableIdentity, commitTitle })).toMatchObject({ version: '1.8.0' })
  })

  it.each([
    ['a different version', 'chore: release 1.8.1 (#580)'],
    ['a non-release title', 'fix(docs): repair links (#580)'],
    ['a trailing reference that is not a PR number', 'chore: release 1.8.0 (#abc)'],
    ['an embedded rather than trailing suffix', 'chore: release 1.8.0 (#580) extra'],
  ])('rejects a release commit title with %s', (_, commitTitle) => {
    expect(() => validateReleaseIdentity({ ...stableIdentity, commitTitle })).toThrow(/Release commit title/)
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
    expect(releasePleaseWorkflow).toContain('branches:\n      - main')
    expect(releasePleaseWorkflow).not.toContain('beta')
    expect(releasePleaseWorkflow).toContain('skip-github-release: true')
    expect(releasePleaseWorkflow).toContain(
      'googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0',
    )
    expect(releasePleaseWorkflow).toContain('client-id: ${{ secrets.RELEASE_APP_CLIENT_ID }}')
    expect(releasePleaseWorkflow).not.toContain('npm publish')
  })

  it('builds one candidate artifact and promotes it without rebuild', () => {
    const publishJob = releaseWorkflow.slice(releaseWorkflow.indexOf('  publish:'))
    const releaseCandidateScript = readFileSync('scripts/release/release-candidate.ts', 'utf8')
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

  it('verifies the documented installers against the public release on every hosted platform', () => {
    const installerJobIndex = releaseWorkflow.indexOf('  verify-installers:')
    const installerJob = releaseWorkflow.slice(installerJobIndex)
    const publicClosureIndex = releaseWorkflow.indexOf('Verify public release closure')

    expect(installerJobIndex).toBeGreaterThan(publicClosureIndex)
    expect(installerJob).toContain('needs: [publish, build-candidate]')
    expect(installerJob).toContain('fail-fast: false')
    expect(installerJob).toContain('os: ubuntu-latest')
    expect(installerJob).toContain('os: macos-latest')
    expect(installerJob).toContain('os: windows-latest')
    expect(installerJob).toContain('installer: install.sh')
    expect(installerJob).toContain('installer: install.ps1')
    expect(installerJob).toContain('ref: ${{ needs.build-candidate.outputs.tag }}')
    expect(installerJob).toContain('QUANTEX_REPO: ${{ github.repository }}')
    expect(installerJob).toContain('QUANTEX_VERSION: ${{ needs.build-candidate.outputs.tag }}')
    expect(installerJob).toContain('QUANTEX_INSTALL_DIR: ${{ runner.temp }}/quantex-install')
    expect(installerJob).toContain('bash ./install.sh')
    expect(installerJob).toContain('& ./install.ps1')
    expect(installerJob).toContain('install.sh installer smoke failed')
    expect(installerJob).toContain('install.ps1 installer smoke failed')
    expect(installerJob).toContain("matrix.installer == 'install.sh'")
    expect(installerJob).toContain("matrix.installer == 'install.ps1'")
  })
})
