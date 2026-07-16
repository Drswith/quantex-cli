import process from 'node:process'
import { beforeAll, describe, expect, it } from 'vitest'
import * as smoke from '../scripts/read-only-lifecycle-smoke'

type SmokeModule = typeof smoke & {
  READ_ONLY_LIFECYCLE_BASELINE?: unknown
  assertReadOnlyLifecycleBaseline?: (value: unknown) => void
  formatReadOnlyLifecycleSummary?: (value: unknown) => string
}

let summary: Awaited<ReturnType<typeof smoke.runReadOnlyLifecycleSmoke>>

describe.skipIf(process.platform === 'win32')('read-only lifecycle real-environment smoke', () => {
  beforeAll(async () => {
    summary = await smoke.runReadOnlyLifecycleSmoke()
  }, 120_000)

  it('keeps all migrated command projections read-only across compatibility fixtures', async () => {
    expect(summary).toMatchObject({
      commands: ['list', 'info', 'inspect', 'resolve', 'capabilities', 'doctor'],
      fixtures: ['absent', 'tracked', 'untracked', 'ghost'],
      invocations: 48,
      modes: ['human', 'json'],
    })
  })

  it('consumes a deterministic normalized compatibility baseline', () => {
    const module = smoke as SmokeModule
    expect(module.READ_ONLY_LIFECYCLE_BASELINE).toBeDefined()
    expect(module.assertReadOnlyLifecycleBaseline).toBeTypeOf('function')
    expect(summary).toHaveProperty('normalizedEvidence')

    const normalizedEvidence = (summary as unknown as { normalizedEvidence?: unknown }).normalizedEvidence
    expect(normalizedEvidence).toEqual(module.READ_ONLY_LIFECYCLE_BASELINE)
    module.assertReadOnlyLifecycleBaseline?.(normalizedEvidence)
  })

  it('formats the normalized evidence as deterministic portable JSON', () => {
    const module = smoke as SmokeModule
    expect(module.formatReadOnlyLifecycleSummary).toBeTypeOf('function')
    const normalizedEvidence = (summary as unknown as { normalizedEvidence?: unknown }).normalizedEvidence
    const formatted = module.formatReadOnlyLifecycleSummary?.(normalizedEvidence)

    expect(JSON.parse(formatted ?? '')).toEqual({
      kind: 'read-only-lifecycle-smoke',
      normalizedEvidence: module.READ_ONLY_LIFECYCLE_BASELINE,
    })
    expect(formatted).toBe(module.formatReadOnlyLifecycleSummary?.(structuredClone(normalizedEvidence)))
  })

  it.each([
    ['tracked/untracked', 'tracked', 'untracked'],
    ['absent/ghost', 'absent', 'ghost'],
  ] as const)('rejects a %s fixture interchange', (_label, left, right) => {
    const module = smoke as SmokeModule
    expect(module.assertReadOnlyLifecycleBaseline).toBeTypeOf('function')
    const normalizedEvidence = structuredClone(
      (summary as unknown as { normalizedEvidence?: Record<string, unknown> }).normalizedEvidence,
    )
    expect(normalizedEvidence).toBeDefined()
    const leftEvidence = normalizedEvidence?.[left]
    normalizedEvidence![left] = normalizedEvidence![right]!
    normalizedEvidence![right] = leftEvidence!

    expect(() => module.assertReadOnlyLifecycleBaseline?.(normalizedEvidence)).toThrow(/compatibility baseline/i)
  })
})
