import { describe, expect, it } from 'vitest'
import { resolveShortcutInvocation } from '../../src/commands/shortcut'

const knownCommands = new Set(['install', 'exec', 'help', '--help', '--version', '-v'])

describe('resolveShortcutInvocation', () => {
  it('returns undefined for an empty invocation, a known command, or an unknown leading option', () => {
    expect(resolveShortcutInvocation([], knownCommands, { agentFriendly: false })).toBeUndefined()
    expect(resolveShortcutInvocation(['install', 'codex'], knownCommands, { agentFriendly: false })).toBeUndefined()
    expect(resolveShortcutInvocation(['--unknown', 'codex'], knownCommands, { agentFriendly: false })).toBeUndefined()
  })

  it('preserves agent argument order after the shortcut target', () => {
    expect(resolveShortcutInvocation(['codex', '--model', 'gpt-5', '--', 'prompt'], knownCommands, options())).toEqual({
      agentArgs: ['--model', 'gpt-5', '--', 'prompt'],
      agentName: 'codex',
      dryRun: false,
      noCache: false,
      nonInteractive: false,
      quiet: false,
      refresh: false,
      yes: false,
    })
  })

  it('normalizes every supported shortcut global before the agent', () => {
    expect(
      resolveShortcutInvocation(
        [
          '--yes',
          '--quiet',
          '--non-interactive',
          '--dry-run',
          '--refresh',
          '--color',
          'always',
          '--log-level',
          'debug',
          '--idempotency-key',
          'key-1',
          '--run-id',
          'run-1',
          '--timeout',
          '5s',
          'codex',
          '--help',
        ],
        knownCommands,
        options(),
      ),
    ).toEqual({
      agentArgs: ['--help'],
      agentName: 'codex',
      color: 'always',
      dryRun: true,
      idempotencyKey: 'key-1',
      logLevel: 'debug',
      noCache: false,
      nonInteractive: true,
      quiet: true,
      refresh: true,
      runId: 'run-1',
      timeout: '5s',
      yes: true,
    })
  })

  it('recognizes no-cache independently of refresh', () => {
    expect(resolveShortcutInvocation(['--no-cache', 'codex'], knownCommands, options())).toMatchObject({
      agentName: 'codex',
      noCache: true,
      refresh: false,
    })
  })

  it.each(['--output', '--color', '--log-level', '--idempotency-key', '--run-id', '--timeout'])(
    'returns a stable missing-value error for %s',
    option => {
      expect(resolveShortcutInvocation([option], knownCommands, options())).toEqual({
        agentArgs: [],
        agentName: '',
        error: `${option} requires a value`,
      })
    },
  )

  it.each([{ argv: ['--json'] }, { argv: ['--output', 'json'] }, { argv: ['--output', 'ndjson'] }])(
    'rejects structured shortcut output for $argv',
    ({ argv }) => {
      expect(resolveShortcutInvocation([...argv, 'codex'], knownCommands, options())).toEqual({
        agentArgs: [],
        agentName: '',
        error: 'Structured output is not supported for shortcut agent execution yet. Use a management command instead.',
      })
    },
  )

  it('rejects implicit agent-friendly mode but honors explicit human output', () => {
    expect(resolveShortcutInvocation(['codex'], knownCommands, { agentFriendly: true })).toMatchObject({
      error: expect.stringContaining('Structured output is not supported'),
    })
    expect(
      resolveShortcutInvocation(['--output', 'human', 'codex'], knownCommands, { agentFriendly: true }),
    ).toMatchObject({
      agentName: 'codex',
    })
  })
})

function options() {
  return { agentFriendly: false }
}
