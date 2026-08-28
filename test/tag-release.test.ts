import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  findReleaseCommitShaFromLog,
  findUntaggableReason,
  parseManifestVersion,
  parseReleaseVersionFromTitle,
  resolveBranchSealState,
  resolveReleaseTagPlan,
} from '../scripts/release/tag-release'

const releaseSha = 'a'.repeat(40)
const otherSha = 'b'.repeat(40)
const laterSha = 'c'.repeat(40)
const tagReleaseScript = readFileSync('scripts/release/tag-release.ts', 'utf8')
const releasePleaseWorkflow = readFileSync('.github/workflows/release-please.yml', 'utf8')
const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8')

describe('release tagging', () => {
  it('parses release commit titles', () => {
    expect(parseReleaseVersionFromTitle('chore: release 1.8.2-beta')).toBe('1.8.2-beta')
    expect(parseReleaseVersionFromTitle('fix(docs): repair links')).toBeNull()
  })

  it('no-ops when no release commit for the manifest version is in reach', () => {
    expect(
      resolveReleaseTagPlan({
        branch: 'beta',
        ciSha: releaseSha,
        packageVersion: '1.8.2-beta',
        releaseSha: null,
        tagSha: null,
      }),
    ).toEqual({ action: 'noop', reason: 'no release commit for 1.8.2-beta in recent branch history' })
  })

  it('tags when release commit passed CI and tag is missing', () => {
    expect(
      resolveReleaseTagPlan({
        branch: 'beta',
        ciSha: releaseSha,
        packageVersion: '1.8.2-beta',
        releaseSha,
        tagSha: null,
      }),
    ).toEqual({
      action: 'tag',
      reason: 'release tag missing for validated release commit',
      tag: 'v1.8.2-beta',
      version: '1.8.2-beta',
    })
  })

  // The race that stranded v1.9.3: two archive PRs merged either side of the
  // Release PR, so the head had moved on by the time the job evaluated.
  it('tags the release commit even when later commits sit on top of it', () => {
    expect(
      resolveReleaseTagPlan({
        branch: 'main',
        ciSha: releaseSha,
        packageVersion: '1.9.3',
        releaseSha,
        tagSha: null,
      }),
    ).toEqual({
      action: 'tag',
      reason: 'release tag missing for validated release commit',
      tag: 'v1.9.3',
      version: '1.9.3',
    })
  })

  it('rejects deferred stable v2 before tag creation', () => {
    expect(() =>
      resolveReleaseTagPlan({
        branch: 'main',
        ciSha: releaseSha,
        packageVersion: '2.0.0',
        releaseSha,
        tagSha: null,
      }),
    ).toThrow(/Stable 2\.x releases are deferred until the required v2 refactor has merged/)
  })

  it('keeps prerelease tag planning outside the stable v2 gate', () => {
    expect(
      resolveReleaseTagPlan({
        branch: 'main',
        ciSha: releaseSha,
        packageVersion: '2.0.0-beta.1',
        releaseSha,
        tagSha: null,
      }),
    ).toMatchObject({ action: 'tag', tag: 'v2.0.0-beta.1' })
  })

  it('relabels only when tag already points at the release commit', () => {
    expect(
      resolveReleaseTagPlan({
        branch: 'beta',
        ciSha: null,
        packageVersion: '1.8.2-beta',
        releaseSha,
        tagSha: releaseSha,
      }),
    ).toEqual({
      action: 'relabel-only',
      reason: 'release tag already points at the release commit',
      tag: 'v1.8.2-beta',
      version: '1.8.2-beta',
    })
  })

  it('fails closed when tag exists at a different commit', () => {
    expect(() =>
      resolveReleaseTagPlan({
        branch: 'main',
        ciSha: releaseSha,
        packageVersion: '1.8.0',
        releaseSha,
        tagSha: otherSha,
      }),
    ).toThrow(/Tag v1\.8\.0 points at/)
  })

  it('fails closed when CI has not succeeded on the release commit', () => {
    expect(() =>
      resolveReleaseTagPlan({
        branch: 'main',
        ciSha: null,
        packageVersion: '1.8.0',
        releaseSha,
        tagSha: null,
      }),
    ).toThrow(/lacks successful protected-branch push CI/)
  })

  // CI success on the branch head is not CI success on the release commit once
  // the head has moved, so the sha match must stay exact.
  it('fails closed when CI succeeded on a later commit instead of the release commit', () => {
    expect(() =>
      resolveReleaseTagPlan({
        branch: 'main',
        ciSha: laterSha,
        packageVersion: '1.9.3',
        releaseSha,
        tagSha: null,
      }),
    ).toThrow(/lacks successful protected-branch push CI/)
  })

  it('pushes tags through git push so the release workflow triggers from the tag event', () => {
    expect(tagReleaseScript).toContain("'push', remoteUrl, `refs/tags/${plan.tag}`")
  })

  // The bot's tag push is attributed to GITHUB_TOKEN and never starts release.yml,
  // so polling for that run only ever expired its grace period. Dispatch is the
  // trigger now; a reintroduced wait would silently cost two minutes per release.
  it('dispatches the release workflow directly after the tag push', () => {
    expect(tagReleaseScript).toContain('dispatchReleaseWorkflow')
    expect(tagReleaseScript).not.toContain('ensureReleaseWorkflowTriggered')
    expect(tagReleaseScript).not.toContain('RELEASE_TAG_DISPATCH_GRACE_MS')
    expect(releasePleaseWorkflow).not.toContain('workflow_dispatch')
  })

  it('keeps the tag trigger available for maintainer-pushed tags', () => {
    expect(releaseWorkflow).toContain('tags:')
    expect(releaseWorkflow).toContain("- 'v*'")
  })

  it('recognises an untaggable state, without any network call', () => {
    expect(findUntaggableReason({ packageVersion: '1.8.6', releaseSha: null })).toBe(
      'no release commit for 1.8.6 in recent branch history',
    )
    expect(findUntaggableReason({ packageVersion: 'not-a-version', releaseSha })).toMatch(/is not a release version/)
    expect(findUntaggableReason({ packageVersion: '1.8.6', releaseSha })).toBeNull()
    expect(findUntaggableReason({ packageVersion: '1.9.0-beta.1', releaseSha })).toBeNull()
  })

  it('finds the release commit for the manifest version anywhere in the searched log', () => {
    const log = [
      `${laterSha} docs(openspec): archive completed change`,
      `${releaseSha} chore: release 1.9.3 (#637)`,
      `${otherSha} fix(update): scope receipt path evidence to the recorded version (#636)`,
    ].join('\n')

    expect(findReleaseCommitShaFromLog({ log, version: '1.9.3' })).toBe(releaseSha)
    expect(findReleaseCommitShaFromLog({ log, version: '1.9.2' })).toBeNull()
  })

  it('takes the most recent release commit when the version appears more than once', () => {
    const log = [`${laterSha} chore: release 1.9.3 (#640)`, `${releaseSha} chore: release 1.9.3 (#637)`].join('\n')

    expect(findReleaseCommitShaFromLog({ log, version: '1.9.3' })).toBe(laterSha)
  })

  it('bounds the release commit search and walks the protected branch first-parent history', () => {
    expect(tagReleaseScript).toContain('--first-parent')
    expect(tagReleaseScript).toContain('`--max-count=${releaseSearchDepth}`')
  })

  // The CI wait can last 15 minutes and holds the next release-please run behind
  // a non-cancelling group, so a push with nothing to tag must bail out first.
  it('skips the CI wait when there is nothing to tag', () => {
    const runnerBody = tagReleaseScript.slice(tagReleaseScript.indexOf('async function runReleaseTagging'))
    const guardIndex = runnerBody.indexOf('findUntaggableReason')
    const tagCheckIndex = runnerBody.indexOf('readTagSha')
    const waitIndex = runnerBody.indexOf('waitForSuccessfulCi')

    expect(guardIndex).toBeGreaterThan(-1)
    expect(tagCheckIndex).toBeGreaterThan(-1)
    expect(waitIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeLessThan(waitIndex)
    expect(tagCheckIndex).toBeLessThan(waitIndex)
  })

  // An existing tag settles the plan on its own, so paying the wait first would
  // reintroduce the cost the head check used to avoid.
  it('does not wait for CI when the release tag already exists', () => {
    expect(tagReleaseScript).toContain('tagSha ? null : await waitForSuccessfulCi(')
  })
})

describe('branch seal state', () => {
  it('reports sealed only when the manifest version has a tag', () => {
    expect(resolveBranchSealState({ manifestVersion: '1.11.1', tagSha: releaseSha })).toEqual({
      sealed: true,
      reason: 'v1.11.1 exists',
      tag: 'v1.11.1',
      version: '1.11.1',
    })
  })

  // The 2026-08-28 state: the manifest already said 1.11.1 while tag-release was
  // still three minutes away from pushing v1.11.1.
  it('reports unsealed while the manifest version is still untagged', () => {
    expect(resolveBranchSealState({ manifestVersion: '1.11.1', tagSha: null })).toEqual({
      sealed: false,
      reason: 'v1.11.1 does not exist yet',
      tag: 'v1.11.1',
      version: '1.11.1',
    })
  })

  it('fails closed when the branch manifest version cannot be read', () => {
    expect(resolveBranchSealState({ manifestVersion: null, tagSha: releaseSha }).sealed).toBe(false)
    expect(resolveBranchSealState({ manifestVersion: '  ', tagSha: releaseSha }).reason).toMatch(
      /no version could be read from \.release-please-manifest\.json/,
    )
  })

  it('fails closed on a manifest version that is not a release version', () => {
    expect(resolveBranchSealState({ manifestVersion: 'next', tagSha: releaseSha })).toEqual({
      sealed: false,
      reason: 'branch manifest version is not a release version: next',
    })
  })

  it('keeps a prerelease manifest version sealable', () => {
    expect(resolveBranchSealState({ manifestVersion: '1.8.2-beta', tagSha: releaseSha }).sealed).toBe(true)
  })

  it('reads the root entry from the manifest and tolerates unusable content', () => {
    expect(parseManifestVersion('{\n  ".": "1.11.1"\n}')).toBe('1.11.1')
    expect(parseManifestVersion('{ "packages/core": "0.3.0" }')).toBeNull()
    expect(parseManifestVersion('not json')).toBeNull()
    expect(parseManifestVersion('["1.11.1"]')).toBeNull()
    expect(parseManifestVersion('{ ".": 111 }')).toBeNull()
  })

  // The gate has to answer for the ref release-please is about to read. Reading
  // this job's checkout would answer for the version it was triggered for, which
  // is how a run queued behind the release commit reached release-please with an
  // unresolvable boundary.
  it('resolves the seal state from the branch tip rather than the checkout', () => {
    const sealBody = tagReleaseScript.slice(tagReleaseScript.indexOf('async function publishBranchSealState'))

    expect(sealBody).toContain("await git(['fetch', '--force', 'origin', input.branch, '--tags'])")
    expect(sealBody).toContain('readBranchManifestVersion')
    expect(sealBody).not.toContain('package.json')
    expect(tagReleaseScript).toContain('`origin/${branch}:${releaseManifestPath}`')
  })

  // Every path that finishes the job has to answer, including an ordinary push
  // that had nothing to tag; otherwise the gate reads empty and preparation
  // never runs again.
  it('publishes the seal state outside the tagging path so early returns cannot skip it', () => {
    const runnerBody = tagReleaseScript.slice(
      tagReleaseScript.indexOf('async function runReleaseTagging'),
      tagReleaseScript.indexOf('async function tagBranchRelease'),
    )

    expect(runnerBody).toContain('await tagBranchRelease({ branch, token })')
    expect(runnerBody).toContain('await publishBranchSealState({ branch })')
    expect(tagReleaseScript).toContain("await writeJobOutput('sealed', state.sealed ? 'true' : 'false')")
  })
})
