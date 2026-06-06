import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { setCliContext } from '../../src/cli-context'
import { executeCommandWithRuntime } from '../../src/command-runtime'
import { listCommand } from '../../src/commands/list'
import { runCommand } from '../../src/commands/run'
import { getExitCodeForResult } from '../../src/errors'

const agentLookupSpy = vi.spyOn(agents, 'getAgentByNameOrAlias')

const testAgent = {
  name: 'test-agent',
  lookupAliases: [],
  displayName: 'Test Agent',
  homepage: 'https://example.com',
  binaryName: 'test-bin',
  packages: { npm: 'test-pkg' },
  platforms: {
    linux: [{ type: 'bun' as const }],
    macos: [{ type: 'bun' as const }],
    windows: [{ type: 'bun' as const }],
  },
}

let tempHome = ''

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), 'quantex-state-read-error-'))
  vi.stubEnv('HOME', tempHome)
  await mkdir(join(tempHome, '.quantex'), { recursive: true })
  agentLookupSpy.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('state read errors', () => {
  it('returns structured STATE_READ_ERROR for invalid JSON in json mode', async () => {
    await writeFile(join(tempHome, '.quantex', 'state.json'), 'not json', 'utf8')
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'state-read-error-run',
    })

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const result = await executeCommandWithRuntime({
        action: 'list',
        run: () => listCommand(),
        target: {
          kind: 'system',
          name: 'agents',
        },
      })

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('STATE_READ_ERROR')
      expect(result.error?.details).toMatchObject({
        stateFilePath: join(tempHome, '.quantex', 'state.json'),
      })
      expect(getExitCodeForResult(result)).toBe(12)
      expect(errorSpy).not.toHaveBeenCalled()
      expect(logSpy).toHaveBeenCalled()

      const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string)
      expect(payload.ok).toBe(false)
      expect(payload.error.code).toBe('STATE_READ_ERROR')
    } finally {
      logSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })

  it('prints a human error instead of crashing for invalid installed agent records', async () => {
    await writeFile(
      join(tempHome, '.quantex', 'state.json'),
      JSON.stringify({
        installedAgents: {
          codex: {
            agentName: 'codex',
            installType: 'invalid-install-type',
          },
        },
      }),
      'utf8',
    )
    setCliContext({
      interactive: false,
      outputMode: 'human',
      runId: 'state-read-error-human',
    })

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const result = await executeCommandWithRuntime({
        action: 'list',
        run: () => listCommand(),
        target: {
          kind: 'system',
          name: 'agents',
        },
      })

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('STATE_READ_ERROR')
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to read Quantex state file'))
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('returns structured STATE_READ_ERROR for shortcut agent execution', async () => {
    await writeFile(join(tempHome, '.quantex', 'state.json'), '[]', 'utf8')
    agentLookupSpy.mockReturnValue(testAgent)
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'state-read-error-run',
    })

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const exitCode = await runCommand('test-agent', ['--help'])
      expect(exitCode).toBe(12)

      const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string)
      expect(payload.ok).toBe(false)
      expect(payload.error.code).toBe('STATE_READ_ERROR')
      expect(payload.action).toBe('exec')
    } finally {
      logSpy.mockRestore()
    }
  })
})
