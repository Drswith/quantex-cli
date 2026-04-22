import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { getIdempotencyDir, getIdempotencyFilePath, loadIdempotencyRecord, saveIdempotencyRecord } from '../src/idempotency'
import { createSuccessResult } from '../src/output'

describe('idempotency storage', () => {
  const tempHome = '/tmp/quantex-idempotency-test'

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

    expect(getIdempotencyDir()).toBe(`${tempHome}/.quantex/idempotency`)
    expect(existsSync(getIdempotencyFilePath('install-codex'))).toBe(true)
    expect(readFileSync(getIdempotencyFilePath('install-codex'), 'utf8')).toContain('"action": "install"')
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
})
