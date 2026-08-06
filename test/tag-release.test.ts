import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  findNonReleaseHeadReason,
  parseReleaseVersionFromTitle,
  resolveReleaseTagPlan,
} from '../scripts/release/tag-release'

const headSha = 'a'.repeat(40)
const tagReleaseScript = readFileSync('scripts/release/tag-release.ts', 'utf8')
const releasePleaseWorkflow = readFileSync('.github/workflows/release-please.yml', 'utf8')

describe('release tagging', () => {
  it('parses release commit titles', () => {
    expect(parseReleaseVersionFromTitle('chore: release 1.8.2-beta')).toBe('1.8.2-beta')
    expect(parseReleaseVersionFromTitle('fix(docs): repair links')).toBeNull()
  })

  it('no-ops when branch head is not a release commit', () => {
    expect(
      resolveReleaseTagPlan({
        branch: 'beta',
        branchHeadSha: headSha,
        commitTitle: 'fix(docs): repair links',
        packageVersion: '1.8.2-beta',
        tagSha: null,
        ciSha: headSha,
      }),
    ).toEqual({ action: 'noop', reason: 'branch head is not a release commit' })
  })

  it('tags when release commit passed CI and tag is missing', () => {
    expect(
      resolveReleaseTagPlan({
        branch: 'beta',
        branchHeadSha: headSha,
        commitTitle: 'chore: release 1.8.2-beta',
        packageVersion: '1.8.2-beta',
        tagSha: null,
        ciSha: headSha,
      }),
    ).toEqual({
      action: 'tag',
      reason: 'release tag missing for validated release commit',
      tag: 'v1.8.2-beta',
      version: '1.8.2-beta',
    })
  })

  it('relabels only when tag already points at branch head', () => {
    expect(
      resolveReleaseTagPlan({
        branch: 'beta',
        branchHeadSha: headSha,
        commitTitle: 'chore: release 1.8.2-beta',
        packageVersion: '1.8.2-beta',
        tagSha: headSha,
        ciSha: headSha,
      }),
    ).toEqual({
      action: 'relabel-only',
      reason: 'release tag already points at branch head',
      tag: 'v1.8.2-beta',
      version: '1.8.2-beta',
    })
  })

  it('fails closed when tag exists at a different commit', () => {
    expect(() =>
      resolveReleaseTagPlan({
        branch: 'main',
        branchHeadSha: headSha,
        commitTitle: 'chore: release 1.8.0',
        packageVersion: '1.8.0',
        tagSha: 'b'.repeat(40),
        ciSha: headSha,
      }),
    ).toThrow(/Tag v1\.8\.0 points at/)
  })

  it('fails closed when CI has not succeeded on the release commit', () => {
    expect(() =>
      resolveReleaseTagPlan({
        branch: 'main',
        branchHeadSha: headSha,
        commitTitle: 'chore: release 1.8.0',
        packageVersion: '1.8.0',
        tagSha: null,
        ciSha: null,
      }),
    ).toThrow(/lacks successful protected-branch push CI/)
  })

  it('pushes tags through git push so the release workflow triggers from the tag event', () => {
    expect(tagReleaseScript).toContain("'push', remoteUrl, `refs/tags/${plan.tag}`")
  })

  it('dispatches the release workflow only as a fallback when the tag event did not fire', () => {
    expect(tagReleaseScript).toContain('ensureReleaseWorkflowTriggered')
    expect(tagReleaseScript).toContain('findReleaseWorkflowRun')
    expect(releasePleaseWorkflow).not.toContain('workflow_dispatch')
  })

  it('recognises a head that can never be tagged, without any network call', () => {
    expect(findNonReleaseHeadReason({ commitTitle: 'docs(openspec): tidy notes', packageVersion: '1.8.6' })).toBe(
      'branch head is not a release commit',
    )
    expect(findNonReleaseHeadReason({ commitTitle: 'chore: release 1.8.6', packageVersion: 'not-a-version' })).toMatch(
      /is not a release version/,
    )
    expect(findNonReleaseHeadReason({ commitTitle: 'chore: release 1.8.6 (#584)', packageVersion: '1.8.6' })).toBeNull()
    expect(
      findNonReleaseHeadReason({ commitTitle: 'chore: release 1.9.0-beta.1', packageVersion: '1.9.0-beta.1' }),
    ).toBeNull()
  })

  // The CI wait can last 15 minutes and holds the next release-please run behind
  // a non-cancelling group, so an ordinary push must bail out before it starts.
  it('skips the CI wait when the branch head is not a release commit', () => {
    const runnerBody = tagReleaseScript.slice(tagReleaseScript.indexOf('async function runReleaseTagging'))
    const guardIndex = runnerBody.indexOf('findNonReleaseHeadReason')
    const waitIndex = runnerBody.indexOf('waitForSuccessfulCi')

    expect(guardIndex).toBeGreaterThan(-1)
    expect(waitIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeLessThan(waitIndex)
  })
})
