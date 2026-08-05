import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseReleaseVersionFromTitle, resolveReleaseTagPlan } from '../scripts/release/tag-release'

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
})
