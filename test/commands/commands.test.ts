import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../../src/cli-context'
import { commandsCommand } from '../../src/commands/commands'

describe('commandsCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('shows a human-readable command catalog', async () => {
    await commandsCommand()

    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Quantex Commands')
    expect(output).toContain('commands')
    expect(output).toContain('capabilities')
    expect(output).toContain('inspect')
    expect(output).toContain('resolve')
    expect(output).toContain('schema')
    expect(output).toContain('exec')
  })

  it('emits the command catalog in json mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'commands-run-id',
    })

    await commandsCommand()

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.ok).toBe(true)
    expect(payload.action).toBe('commands')
    expect(payload.data.commands.some((command: { name: string }) => command.name === 'commands')).toBe(true)
    expect(payload.data.commands.some((command: { name: string }) => command.name === 'inspect')).toBe(true)
    expect(payload.data.commands.some((command: { name: string }) => command.name === 'resolve')).toBe(true)
    expect(payload.data.commands.some((command: { name: string }) => command.name === 'schema')).toBe(true)
    expect(payload.data.commands.find((command: { flags: string[], name: string }) => command.name === 'install')?.flags).toContain('--yes')
    expect(payload.data.commands.find((command: { flags: string[], name: string }) => command.name === 'install')?.flags).toContain('--dry-run')
    expect(payload.data.commands.find((command: { flags: string[], name: string }) => command.name === 'inspect')?.flags).toContain('--refresh')
    expect(payload.data.commands.find((command: { flags: string[], name: string }) => command.name === 'inspect')?.flags).toContain('--no-cache')
    expect(payload.meta.runId).toBe('commands-run-id')
  })
})
