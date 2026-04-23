import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../src/cli-context'
import { commandsCommand } from '../src/commands/commands'
import { getSchemaCatalog } from '../src/commands/schema'

describe('surface contracts', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('keeps the schema catalog stable', () => {
    expect(getSchemaCatalog().map(schema => schema.name)).toMatchInlineSnapshot(`
      [
        "capabilities",
        "commands",
        "doctor",
        "exec",
        "ensure",
        "inspect",
        "resolve",
        "schema",
      ]
    `)
  })

  it('keeps the command catalog surface stable', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'contracts-run-id',
    })

    const result = await commandsCommand()

    expect(result.data?.commands.map(command => command.name)).toMatchInlineSnapshot(`
      [
        "capabilities",
        "commands",
        "config",
        "doctor",
        "exec",
        "ensure",
        "info",
        "inspect",
        "install",
        "list",
        "resolve",
        "schema",
        "update",
        "uninstall",
        "upgrade",
      ]
    `)
    expect(result.data?.commands.find(command => command.name === 'install')?.flags).toContain('--dry-run')
    expect(result.data?.commands.find(command => command.name === 'upgrade')?.flags).toContain('--refresh')
  })
})
