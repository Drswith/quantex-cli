import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getIdempotencyDir,
  getIdempotencyFilePath,
  loadIdempotencyRecord,
  saveIdempotencyRecord,
} from '../src/idempotency'
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
})
