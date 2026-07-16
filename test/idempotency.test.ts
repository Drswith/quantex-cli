import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getIdempotencyDir,
  getIdempotencyFilePath,
  loadIdempotencyRecord,
  loadVersionedIdempotencyRecord,
  saveIdempotencyRecord,
  saveVersionedIdempotencyRecord,
  type VersionedIdempotencyRecordInput,
} from '../src/idempotency'
import { canonicalizeMutationRequest, fingerprintCanonicalValue } from '../src/idempotency/canonical'
import {
  canonicalizeAllOfPostcondition,
  canonicalizeReceiptSet,
  IDEMPOTENCY_RECORD_SCHEMA_VERSION,
  type FingerprintedPayload,
  type IdempotencyPostcondition,
  type IdempotencyReceiptSnapshot,
} from '../src/idempotency/schema'
import { createSuccessResult } from '../src/output'

describe('idempotency storage', () => {
  const tempHome = join(tmpdir(), 'quantex-idempotency-test')

  afterEach(() => {
    delete process.env.HOME
    rmSync(tempHome, { force: true, recursive: true })
  })

  it('stores command results under the quantex idempotency directory', async () => {
    process.env.HOME = tempHome
    mkdirSync(tempHome, { recursive: true })

    await saveIdempotencyRecord('install-codex', {
      action: 'install',
      result: createSuccessResult({
        action: 'install',
        data: {
          installed: true,
        },
        target: {
          kind: 'agent',
          name: 'codex',
        },
      }),
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    expect(getIdempotencyDir()).toBe(join(tempHome, '.quantex', 'idempotency'))
    expect(existsSync(getIdempotencyFilePath('install-codex'))).toBe(true)
    expect(readFileSync(getIdempotencyFilePath('install-codex'), 'utf8')).toContain('"action": "install"')
  })

  it('maps distinct client keys to distinct on-disk filenames', () => {
    process.env.HOME = tempHome
    mkdirSync(tempHome, { recursive: true })

    const firstPath = getIdempotencyFilePath('job-1/install/codex')
    const secondPath = getIdempotencyFilePath('job-1_install_codex')

    expect(firstPath).not.toBe(secondPath)
    expect(firstPath).toMatch(/[a-f0-9]{64}\.json$/)
    expect(secondPath).toMatch(/[a-f0-9]{64}\.json$/)
  })

  it('stores and loads records independently for keys that previously collided after sanitization', async () => {
    process.env.HOME = tempHome
    mkdirSync(tempHome, { recursive: true })

    await saveIdempotencyRecord('job-1/install/codex', {
      action: 'install',
      result: createSuccessResult({
        action: 'install',
        data: {
          installed: true,
        },
        target: {
          kind: 'agent',
          name: 'codex',
        },
      }),
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    expect(await loadIdempotencyRecord('job-1_install_codex')).toBeUndefined()
    expect((await loadIdempotencyRecord('job-1/install/codex'))?.target?.name).toBe('codex')
  })

  it('loads a stored idempotency record', async () => {
    process.env.HOME = tempHome
    mkdirSync(tempHome, { recursive: true })

    await saveIdempotencyRecord('install-codex', {
      action: 'install',
      result: createSuccessResult({
        action: 'install',
        data: {
          installed: true,
        },
        target: {
          kind: 'agent',
          name: 'codex',
        },
      }),
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    const record = await loadIdempotencyRecord('install-codex')
    expect(record?.action).toBe('install')
    expect(record?.target?.name).toBe('codex')
    expect(record?.result.ok).toBe(true)
  })

  describe('versioned replay evidence', () => {
    const createdAt = new Date('2026-07-13T00:00:00.000Z')

    it('distinguishes a missing record from invalid evidence', async () => {
      prepareHome()

      await expect(loadVersionedIdempotencyRecord('missing-key')).resolves.toEqual({ kind: 'missing' })
    })

    it('stores and loads a valid current-schema record with an injected clock and TTL', async () => {
      prepareHome()

      await saveVersionedIdempotencyRecord('update-codex', versionedRecordInput(), {
        now: () => createdAt,
        ttlMs: 2_000,
      })

      const loaded = await loadVersionedIdempotencyRecord('update-codex', {
        now: () => new Date('2026-07-13T00:00:01.000Z'),
      })
      expect(loaded.kind).toBe('valid')
      if (loaded.kind !== 'valid') throw new Error('Expected current replay evidence.')
      expect(loaded.record.schemaVersion).toBe(IDEMPOTENCY_RECORD_SCHEMA_VERSION)
      expect(loaded.record.createdAt).toBe('2026-07-13T00:00:00.000Z')
      expect(loaded.record.expiresAt).toBe('2026-07-13T00:00:02.000Z')
      expect(loaded.record.request.payload.targets).toEqual(['codex'])
    })

    it('defaults versioned evidence to a 24-hour lifetime', async () => {
      prepareHome()
      await saveVersionedIdempotencyRecord('default-ttl', versionedRecordInput(), { now: () => createdAt })

      const loaded = await loadVersionedIdempotencyRecord('default-ttl', { now: () => createdAt })
      if (loaded.kind !== 'valid') throw new Error('Expected current replay evidence.')
      expect(loaded.record.expiresAt).toBe('2026-07-14T00:00:00.000Z')
    })

    it('deletes only a valid expired record and reports the expiration', async () => {
      prepareHome()
      await saveVersionedIdempotencyRecord('expired-key', versionedRecordInput(), {
        now: () => createdAt,
        ttlMs: 1_000,
      })

      const loaded = await loadVersionedIdempotencyRecord('expired-key', {
        now: () => new Date('2026-07-13T00:00:01.000Z'),
      })

      expect(loaded.kind).toBe('expired')
      if (loaded.kind !== 'expired') throw new Error('Expected expired replay evidence.')
      expect(loaded.record.expiresAt).toBe('2026-07-13T00:00:01.000Z')
      expect(existsSync(getIdempotencyFilePath('expired-key'))).toBe(false)
    })

    it.each([
      {
        content: '{ definitely-not-json\n',
        expectedReason: 'invalid-json',
        name: 'corrupt JSON',
      },
      {
        content: () => JSON.stringify({ ...storedVersionedRecord(), schemaVersion: 2 }),
        expectedReason: 'unsupported-schema',
        name: 'an unsupported schema',
      },
      {
        content: () =>
          JSON.stringify({
            action: 'update',
            createdAt: '2026-07-13T00:00:00.000Z',
            expiresAt: '2026-07-14T00:00:00.000Z',
            result: versionedRecordInput().result,
          }),
        expectedReason: 'legacy-record',
        name: 'legacy evidence',
      },
      {
        content: () => {
          const record = storedVersionedRecord()
          return JSON.stringify({
            ...record,
            request: { ...record.request, fingerprint: '0'.repeat(64) },
          })
        },
        expectedReason: 'fingerprint-mismatch',
        name: 'a fingerprint mismatch',
      },
    ] as const)('retains $name byte-for-byte and reports $expectedReason', async ({ content, expectedReason }) => {
      prepareHome()
      const path = getIdempotencyFilePath('invalid-key')
      const bytes = typeof content === 'function' ? content() : content
      writeFileSync(path, bytes, 'utf8')

      await expect(
        loadVersionedIdempotencyRecord('invalid-key', {
          now: () => new Date('2026-07-15T00:00:00.000Z'),
        }),
      ).resolves.toEqual({
        kind: 'invalid',
        reason: expectedReason,
      })
      expect(readFileSync(path, 'utf8')).toBe(bytes)
    })

    it('uses raw caller keys for versioned storage without sanitized-key collisions', async () => {
      prepareHome()
      await saveVersionedIdempotencyRecord('job-1/update/codex', versionedRecordInput(), {
        now: () => createdAt,
      })

      expect(await loadVersionedIdempotencyRecord('job-1_update_codex')).toEqual({ kind: 'missing' })
      expect(
        (
          await loadVersionedIdempotencyRecord('job-1/update/codex', {
            now: () => createdAt,
          })
        ).kind,
      ).toBe('valid')
    })

    it.each([
      {
        payload: {
          ...canonicalizeReceiptSet([{ providerId: 'npm', schemaVersion: 1, targetId: 'codex', version: '1.2.3' }]),
          extra: true,
        },
        slot: 'receipt',
      },
      {
        payload: {
          ...canonicalizeAllOfPostcondition([
            { expectedVersion: '1.2.3', kind: 'version-satisfies', targetId: 'codex' },
          ]),
          extra: true,
        },
        slot: 'postcondition',
      },
    ] as const)('rejects extra $slot wrapper fields at the save boundary', async ({ payload, slot }) => {
      prepareHome()
      const input = { ...versionedRecordInput(), [slot]: evidence(payload) } as VersionedIdempotencyRecordInput

      await expect(saveVersionedIdempotencyRecord(`extra-${slot}`, input)).rejects.toThrow(
        'Invalid versioned idempotency record: invalid-payload',
      )
      expect(existsSync(getIdempotencyFilePath(`extra-${slot}`))).toBe(false)
    })

    it('serializes deterministic pretty JSON with one trailing newline and no temporary residue', async () => {
      prepareHome()
      await saveVersionedIdempotencyRecord('serialized-key', versionedRecordInput(), {
        now: () => createdAt,
        ttlMs: 1_000,
      })

      const loaded = await loadVersionedIdempotencyRecord('serialized-key', { now: () => createdAt })
      if (loaded.kind !== 'valid') throw new Error('Expected current replay evidence.')
      expect(readFileSync(getIdempotencyFilePath('serialized-key'), 'utf8')).toBe(
        `${JSON.stringify(loaded.record, null, 2)}\n`,
      )
      expect(readdirSync(getIdempotencyDir())).toEqual([basename(getIdempotencyFilePath('serialized-key'))])
    })

    it('serializes equivalent evidence identically regardless of object insertion order', async () => {
      prepareHome()
      const first = versionedRecordInput()
      const reorderedPlan = {
        targetId: 'codex',
        resolvedVersion: '1.2.3',
        requestedVersion: 'latest',
      }
      const second: VersionedIdempotencyRecordInput = {
        ...first,
        resolvedPlan: evidence(reorderedPlan),
      }

      await saveVersionedIdempotencyRecord('first-order', first, { now: () => createdAt })
      await saveVersionedIdempotencyRecord('second-order', second, { now: () => createdAt })

      expect(readFileSync(getIdempotencyFilePath('first-order'), 'utf8')).toBe(
        readFileSync(getIdempotencyFilePath('second-order'), 'utf8'),
      )
    })

    it('cleans up a same-directory temporary file when the atomic rename fails', async () => {
      prepareHome()
      const finalPath = getIdempotencyFilePath('blocked-key')
      mkdirSync(finalPath)

      await expect(
        saveVersionedIdempotencyRecord('blocked-key', versionedRecordInput(), { now: () => createdAt }),
      ).rejects.toThrow()
      expect(readdirSync(getIdempotencyDir())).toEqual([basename(finalPath)])
    })

    it('cleans up a partially written temporary file when writing fails', async () => {
      prepareHome()
      const finalPath = getIdempotencyFilePath('partial-write-key')
      const attemptedTemporaryPaths: string[] = []

      await expect(
        saveVersionedIdempotencyRecord('partial-write-key', versionedRecordInput(), {
          fileSystem: {
            writeFile: async (path, data) => {
              attemptedTemporaryPaths.push(path)
              writeFileSync(path, data.slice(0, 24), 'utf8')
              throw new Error('simulated partial write failure')
            },
          },
          now: () => createdAt,
        }),
      ).rejects.toThrow('simulated partial write failure')

      expect(attemptedTemporaryPaths).toHaveLength(1)
      expect(attemptedTemporaryPaths[0]).toMatch(/\.tmp$/)
      expect(existsSync(finalPath)).toBe(false)
      expect(readdirSync(getIdempotencyDir()).filter(entry => entry.endsWith('.tmp'))).toEqual([])
    })
  })
})

function prepareHome(): void {
  const tempHome = join(tmpdir(), 'quantex-idempotency-test')
  process.env.HOME = tempHome
  mkdirSync(join(tempHome, '.quantex', 'idempotency'), { recursive: true })
}

function versionedRecordInput(): VersionedIdempotencyRecordInput {
  const request = canonicalizeMutationRequest({
    action: 'update',
    options: { requestedVersion: 'latest' },
    targets: ['codex'],
  })
  const receipt: IdempotencyReceiptSnapshot = {
    providerId: 'npm',
    schemaVersion: 1,
    targetId: 'codex',
    version: '1.2.3',
  }
  const postcondition: IdempotencyPostcondition = {
    expectedVersion: '1.2.3',
    kind: 'version-satisfies',
    targetId: 'codex',
  }

  return {
    postcondition: evidence(postcondition),
    receipt: evidence(receipt),
    request: evidence(request),
    resolvedPlan: evidence({ requestedVersion: 'latest', resolvedVersion: '1.2.3', targetId: 'codex' }),
    result: createSuccessResult({
      action: 'update',
      data: { status: 'updated' },
      target: { kind: 'agent', name: 'codex' },
    }),
  }
}

function storedVersionedRecord() {
  return {
    ...versionedRecordInput(),
    createdAt: '2026-07-13T00:00:00.000Z',
    expiresAt: '2026-07-14T00:00:00.000Z',
    schemaVersion: IDEMPOTENCY_RECORD_SCHEMA_VERSION,
  }
}

function evidence<T>(payload: T): FingerprintedPayload<T> {
  return { fingerprint: fingerprintCanonicalValue(payload), payload }
}
