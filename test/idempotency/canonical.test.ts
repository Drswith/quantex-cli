import { describe, expect, it } from 'vitest'
import { canonicalizeMutationRequest, fingerprintCanonicalValue } from '../../src/idempotency/canonical'

describe('canonical mutation requests', () => {
  it('normalizes reordered and duplicate batch targets as one request', () => {
    const first = canonicalizeMutationRequest({
      action: 'update',
      options: { strategy: 'latest-major' },
      targets: ['cursor', 'codex', 'cursor'],
    })
    const second = canonicalizeMutationRequest({
      action: 'update',
      options: { strategy: 'latest-major' },
      targets: ['codex', 'cursor'],
    })

    expect(first).toEqual({
      action: 'update',
      options: { strategy: 'latest-major' },
      targets: ['codex', 'cursor'],
    })
    expect(fingerprintCanonicalValue(first)).toBe(fingerprintCanonicalValue(second))
  })

  it('sorts target names by code-point order without locale-dependent comparison', () => {
    expect(canonicalizeMutationRequest({ action: 'update', options: {}, targets: ['😀', '\uE000'] }).targets).toEqual([
      '\uE000',
      '😀',
    ])
  })

  it('distinguishes mutation target and option changes', () => {
    const baseline = canonicalizeMutationRequest({
      action: 'update',
      options: { strategy: 'latest-major' },
      targets: ['codex'],
    })
    const differentTarget = canonicalizeMutationRequest({
      action: 'update',
      options: { strategy: 'latest-major' },
      targets: ['cursor'],
    })
    const differentOption = canonicalizeMutationRequest({
      action: 'update',
      options: { strategy: 'respect-semver' },
      targets: ['codex'],
    })

    expect(fingerprintCanonicalValue(baseline)).not.toBe(fingerprintCanonicalValue(differentTarget))
    expect(fingerprintCanonicalValue(baseline)).not.toBe(fingerprintCanonicalValue(differentOption))
  })

  it('sorts object keys recursively while preserving semantic array order', () => {
    const first = {
      nested: { z: 1, a: { beta: true, alpha: false } },
      steps: ['observe', 'execute', 'verify'],
    }
    const equivalent = {
      steps: ['observe', 'execute', 'verify'],
      nested: { a: { alpha: false, beta: true }, z: 1 },
    }
    const reorderedSteps = {
      nested: { z: 1, a: { beta: true, alpha: false } },
      steps: ['execute', 'observe', 'verify'],
    }

    expect(fingerprintCanonicalValue(first)).toBe(fingerprintCanonicalValue(equivalent))
    expect(fingerprintCanonicalValue(first)).not.toBe(fingerprintCanonicalValue(reorderedSteps))
  })

  it('hashes canonical UTF-8 JSON with lowercase SHA-256', () => {
    expect(fingerprintCanonicalValue({ b: 2, a: 1 })).toBe(
      '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777',
    )
  })

  it('sorts nested integer-like keys by code point during serialization', () => {
    expect(fingerprintCanonicalValue({ nested: { 2: 'two', 10: 'ten' } })).toBe(
      'ab8c2af44c26d4d75c93d5f6371f5a3eb14047e8cb41b112bb987512a5a6e0e6',
    )
  })

  it('preserves explicit undefined array positions as null', () => {
    expect(fingerprintCanonicalValue([undefined])).toBe(fingerprintCanonicalValue([null]))
  })

  it('rejects sparse arrays instead of collapsing holes', () => {
    const sparse: unknown[] = []
    sparse.length = 1

    expect(() => fingerprintCanonicalValue(sparse)).toThrow(TypeError)
  })

  it('rejects representative non-JSON primitive values', () => {
    for (const value of [NaN, Infinity, -Infinity, 1n, () => undefined, Symbol('unsupported')]) {
      expect(() => fingerprintCanonicalValue(value)).toThrow(TypeError)
    }
  })

  it('treats absent and explicitly undefined object properties as equivalent', () => {
    const absent = canonicalizeMutationRequest({ action: 'install', options: {}, targets: ['codex'] })
    const explicitlyUndefined = canonicalizeMutationRequest({
      action: 'install',
      options: { distTag: undefined },
      targets: ['codex'],
    })

    expect(explicitlyUndefined).toEqual(absent)
    expect(fingerprintCanonicalValue(explicitlyUndefined)).toBe(fingerprintCanonicalValue(absent))
  })

  it('encodes absent mutation options consistently and excludes presentation metadata structurally', () => {
    const first = canonicalizeMutationRequest(
      {
        action: 'install',
        options: { distTag: undefined },
        targets: ['codex'],
      },
      {
        color: true,
        outputMode: 'human',
        quiet: false,
        runId: 'run-a',
        timestamp: '2026-07-13T00:00:00.000Z',
        transientProgress: { step: 1 },
      },
    )
    const second = canonicalizeMutationRequest(
      {
        action: 'install',
        options: { distTag: undefined },
        targets: ['codex'],
      },
      {
        color: false,
        outputMode: 'json',
        quiet: true,
        runId: 'run-b',
        timestamp: '2026-07-13T00:00:01.000Z',
        transientProgress: { step: 2 },
      },
    )

    expect(first.options).toEqual({})
    expect(first).toEqual(second)
    expect(JSON.stringify(first)).not.toMatch(/outputMode|color|quiet|runId|timestamp|transientProgress|run-a|run-b/)
    expect(fingerprintCanonicalValue(first)).toBe(fingerprintCanonicalValue(second))
  })
})
