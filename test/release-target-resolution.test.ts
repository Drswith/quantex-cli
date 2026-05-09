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
  it('publishes a pending untagged release commit before creating another release PR', () => {
    const resolution = selectReleaseCandidate({
      commitsBySha: {
        docs999: commit('docs: sync runbook wording'),
        rel123: commit('chore: release 0.16.4'),
        fix111: commit('fix(lock): close owner-less acquisition race'),
      },
      publishedTags: new Set<string>(),
      runs: [
        run(30, 'docs999', '2026-05-09T07:10:00Z'),
        run(20, 'rel123', '2026-05-09T07:05:00Z'),
        run(10, 'fix111', '2026-05-09T07:00:00Z'),
      ],
    })

    expect(resolution.mode).toBe('publish')
    expect(resolution.targetSha).toBe('rel123')
    expect(resolution.reason).toContain('pending untagged release commit 0.16.4')
  })

  it('falls back to release PR mode when no untagged release commit is pending', () => {
    const resolution = selectReleaseCandidate({
      commitsBySha: {
        docs999: commit('docs: sync runbook wording'),
        fix111: commit('fix(lock): close owner-less acquisition race'),
      },
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
        publishedTags: new Set<string>(),
        runs: [run(20, 'rel200', '2026-05-09T07:10:00Z'), run(10, 'rel100', '2026-05-09T07:00:00Z')],
      }),
    ).toThrow(/Multiple successful untagged release commits/)
  })
})
