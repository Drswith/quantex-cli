import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../../src/cli-context'
import { schemaCommand } from '../../src/commands/schema'

describe('schemaCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('shows a human-readable schema catalog', async () => {
    await schemaCommand()

    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Quantex Schemas')
    expect(output).toContain('capabilities')
    expect(output).toContain('commands')
    expect(output).toContain('inspect')
  })

  it('filters to a specific command schema in json mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'schema-run-id',
    })

    await schemaCommand('inspect')

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.ok).toBe(true)
    expect(payload.action).toBe('schema')
    expect(payload.data.commands).toHaveLength(1)
    expect(payload.data.commands[0].name).toBe('inspect')
    expect(payload.data.commands[0].ndjsonEventSchema).toBeDefined()
    expect(payload.meta.runId).toBe('schema-run-id')
  })

  it('returns an invalid-argument error for an unknown schema target', async () => {
    await schemaCommand('missing-command')

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown schema target'))
  })
})
