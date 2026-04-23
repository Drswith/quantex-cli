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
    expect(output).toContain('doctor')
    expect(output).toContain('inspect')
    expect(output).toContain('resolve')
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
    expect(payload.data.commands[0].envelopeSchema.properties.meta.properties.source).toBeDefined()
    expect(payload.data.commands[0].envelopeSchema.properties.meta.properties.fetchedAt).toBeDefined()
    expect(payload.data.commands[0].envelopeSchema.properties.meta.properties.staleAfter).toBeDefined()
    expect(payload.meta.runId).toBe('schema-run-id')
  })

  it('returns an invalid-argument error for an unknown schema target', async () => {
    await schemaCommand('missing-command')

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown schema target'))
  })

  it('returns the doctor schema in json mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'schema-doctor-run-id',
    })

    await schemaCommand('doctor')

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.data.commands).toHaveLength(1)
    expect(payload.data.commands[0].name).toBe('doctor')
    expect(payload.data.commands[0].dataSchema.properties.issues.items.properties.suggestedAction).toBeDefined()
    expect(payload.data.commands[0].dataSchema.properties.issues.items.properties.suggestedCommands).toBeDefined()
  })

  it('returns the exec schema in json mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'schema-exec-run-id',
    })

    await schemaCommand('exec')

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.data.commands).toHaveLength(1)
    expect(payload.data.commands[0].name).toBe('exec')
    expect(payload.data.commands[0].dataSchema.properties.execution.properties.installGuidance).toBeDefined()
    expect(payload.data.commands[0].dataSchema.properties.execution.properties.installPolicy).toBeDefined()
  })

  it('returns the resolve schema with install guidance in json mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'schema-resolve-run-id',
    })

    await schemaCommand('resolve')

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.data.commands).toHaveLength(1)
    expect(payload.data.commands[0].name).toBe('resolve')
    expect(payload.data.commands[0].dataSchema.properties.resolution.properties.installGuidance).toBeDefined()
    expect(payload.data.commands[0].dataSchema.properties.resolution.properties.installed).toBeDefined()
  })
})
