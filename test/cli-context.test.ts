import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { resetCliContext, resolveCliContext } from '../src/cli-context'

describe('resolveCliContext', () => {
  const previousRunId = process.env.QUANTEX_RUN_ID
  const originalStdinIsTTY = process.stdin.isTTY
  const originalStdoutIsTTY = process.stdout.isTTY

  afterEach(() => {
    if (previousRunId === undefined) delete process.env.QUANTEX_RUN_ID
    else process.env.QUANTEX_RUN_ID = previousRunId
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: originalStdinIsTTY })
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: originalStdoutIsTTY })
    resetCliContext()
  })

  it('uses QUANTEX_RUN_ID when no explicit run id is provided', () => {
    process.env.QUANTEX_RUN_ID = 'env-run-id'

    const context = resolveCliContext()

    expect(context.runId).toBe('env-run-id')
  })

  it('prefers explicit run id over QUANTEX_RUN_ID', () => {
    process.env.QUANTEX_RUN_ID = 'env-run-id'

    const context = resolveCliContext({ runId: 'explicit-run-id' })

    expect(context.runId).toBe('explicit-run-id')
  })

  it('resolves ndjson output mode when requested explicitly', () => {
    const context = resolveCliContext({ output: 'ndjson' })

    expect(context.outputMode).toBe('ndjson')
  })

  it('parses timeout values into milliseconds', () => {
    const context = resolveCliContext({ timeout: '30s' })

    expect(context.timeoutMs).toBe(30000)
  })

  it('enables refresh mode when requested', () => {
    const context = resolveCliContext({ refresh: true })

    expect(context.cacheMode).toBe('refresh')
  })

  it('enables no-cache mode when requested', () => {
    const context = resolveCliContext({ noCache: true })

    expect(context.cacheMode).toBe('no-cache')
  })

  it('rejects conflicting refresh flags', () => {
    expect(() => resolveCliContext({ noCache: true, refresh: true })).toThrow(
      'Cannot combine --refresh with --no-cache.',
    )
  })

  it('parses color mode when provided', () => {
    const context = resolveCliContext({ color: 'never' })

    expect(context.colorMode).toBe('never')
  })

  it('parses log level when provided', () => {
    const context = resolveCliContext({ logLevel: 'warn' })

    expect(context.logLevel).toBe('warn')
  })

  it('switches to agent-friendly defaults when stdout is not a tty', () => {
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: false })

    const context = resolveCliContext()

    expect(context.outputMode).toBe('json')
    expect(context.interactive).toBe(false)
  })

  it('switches to agent-friendly defaults when stdin is not a tty', () => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false })

    const context = resolveCliContext()

    expect(context.outputMode).toBe('json')
    expect(context.interactive).toBe(false)
  })

  it('preserves explicit human output when requested in non-tty environments', () => {
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: false })

    const context = resolveCliContext({ output: 'human' })

    expect(context.outputMode).toBe('human')
    expect(context.interactive).toBe(false)
  })
})
