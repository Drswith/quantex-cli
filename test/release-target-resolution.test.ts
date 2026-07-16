import { describe, expect, it } from 'vitest'
import {
  classifyCommitReleaseIntent,
  selectReleaseCandidate,
  type CommitReleaseIntent,
  type SuccessfulCiRun,
} from '../scripts/release-target-resolution.js'

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

describe('release target resolution', () => {
  it('recognizes the exact graduation commit subject as release-worthy while preserving Release-As metadata', () => {
    const intent = commit('feat(release)!: graduate post-redesign line\n\nRelease-As: 1.1.0')
    const resolution = selectReleaseCandidate({
      commitsBySha: { graduation: intent },
      publishedNpmVersions: new Set<string>(),
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

  it('does not mistake Release-As metadata on a chore commit for a release-worthy resolver input', () => {
    expect(commit('chore(release): graduate post-redesign line\n\nRelease-As: 1.1.0').isReleaseWorthy).toBe(false)
  })

  it('publishes a pending untagged release commit before creating another release PR', () => {
    const resolution = selectReleaseCandidate({
      commitsBySha: {
        docs999: commit('docs: sync runbook wording'),
        rel123: commit('chore: release 0.16.4'),
        fix111: commit('fix(lock): close owner-less acquisition race'),
      },
      publishedNpmVersions: new Set<string>(),
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

  it('publishes a release commit when its GitHub release exists but npm package is missing', () => {
    const resolution = selectReleaseCandidate({
      commitsBySha: {
        rel235: commit('chore: release 0.23.5'),
        fix111: commit('fix(cli): harden idempotency target matching'),
      },
      publishedNpmVersions: new Set<string>(['0.23.4']),
      publishedReleaseShas: new Set<string>(['rel235']),
      publishedTags: new Set<string>(['v0.23.5']),
      runs: [run(20, 'rel235', '2026-06-11T03:45:00Z'), run(10, 'fix111', '2026-06-11T03:40:00Z')],
    })

    expect(resolution.mode).toBe('publish')
    expect(resolution.targetSha).toBe('rel235')
    expect(resolution.targetTag).toBe('v0.23.5')
    expect(resolution.reason).toContain('npm package is missing')
  })

  it('does not backfill older npm-missing release commits when the latest release is already on npm', () => {
    const resolution = selectReleaseCandidate({
      commitsBySha: {
        rel235: commit('chore: release 0.23.5'),
        rel172: commit('chore: release 0.17.2'),
      },
      publishedNpmVersions: new Set<string>(['0.23.5']),
      publishedReleaseShas: new Set<string>(['rel235', 'rel172']),
      publishedTags: new Set<string>(['v0.23.5', 'v0.17.2']),
      runs: [run(20, 'rel235', '2026-06-11T03:45:00Z'), run(10, 'rel172', '2026-05-16T03:00:00Z')],
    })

    expect(resolution.mode).toBe('skip')
    expect(resolution.targetSha).toBeNull()
  })

  it('falls back to release PR mode when no untagged release commit is pending', () => {
    const resolution = selectReleaseCandidate({
      commitsBySha: {
        docs999: commit('docs: sync runbook wording'),
        fix111: commit('fix(lock): close owner-less acquisition race'),
      },
      publishedNpmVersions: new Set<string>(),
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
      publishedNpmVersions: new Set<string>(),
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
        publishedNpmVersions: new Set<string>(),
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
      publishedNpmVersions: new Set<string>(['0.5.1']),
      publishedReleaseShas: new Set<string>(['rel060']),
      publishedTags: new Set<string>(),
      runs: [run(20, 'rel164', '2026-05-09T07:10:00Z'), run(10, 'rel060', '2026-04-29T19:00:00Z')],
    })

    expect(resolution.mode).toBe('publish')
    expect(resolution.targetSha).toBe('rel164')
    expect(resolution.reason).toContain('pending untagged release commit 0.16.4')
  })
})
