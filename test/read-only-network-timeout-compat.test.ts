import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../src/cli-context'
import { capabilitiesCommand } from '../src/commands/capabilities'
import { doctorCommand } from '../src/commands/doctor'
import { infoCommand } from '../src/commands/info'
import { listCommand } from '../src/commands/list'
import * as config from '../src/config'

const originalFetch = globalThis.fetch
const getConfigDirSpy = vi.spyOn(config, 'getConfigDir')
const loadConfigSpy = vi.spyOn(config, 'loadConfig')
const originalPath = process.env.PATH
let root: string
let cancelledBodies = 0

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'quantex-network-timeout-compat-'))
  process.env.PATH = root
  getConfigDirSpy.mockReturnValue(root)
  loadConfigSpy.mockResolvedValue({
    defaultPackageManager: 'bun',
    networkRetries: 0,
    networkTimeoutMs: 100,
    npmBunUpdateStrategy: 'latest-major',
    selfUpdateChannel: 'stable',
    versionCacheTtlHours: 6,
  })
  setCliContext({ cacheMode: 'default', interactive: false, outputMode: 'json', runId: 'network-timeout-compat' })
  globalThis.fetch = vi.fn(() =>
    Promise.resolve(
      new Response(
        new ReadableStream({
          cancel() {
            cancelledBodies += 1
          },
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"version":"'))
          },
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      ),
    ),
  ) as unknown as typeof fetch
})

afterAll(async () => {
  process.env.PATH = originalPath
  globalThis.fetch = originalFetch
  getConfigDirSpy.mockRestore()
  loadConfigSpy.mockRestore()
  await rm(root, { force: true, recursive: true })
})

describe('read-only internal network timeout compatibility', () => {
  it('keeps no-timeout v1 command projections successful and cancels every exhausted body', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      const [list, info, capabilities, doctor] = await Promise.all([
        listCommand(),
        infoCommand('codex'),
        capabilitiesCommand(),
        doctorCommand(),
      ])

      expect([list.ok, info.ok, capabilities.ok, doctor.ok]).toEqual([true, true, true, true])
      expect(list.data?.agents.every(agent => agent.latestVersion === undefined)).toBe(true)
      expect(info.data?.inspection.latestVersion).toBeUndefined()
      expect(cancelledBodies).toBeGreaterThan(0)
    } finally {
      log.mockRestore()
    }
  }, 30_000)
})
