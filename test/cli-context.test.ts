import { afterEach, describe, expect, it } from 'vitest'
import { resetCliContext, resolveCliContext } from '../src/cli-context'

describe('resolveCliContext', () => {
  const previousRunId = process.env.QUANTEX_RUN_ID

  afterEach(() => {
    if (previousRunId === undefined)
      delete process.env.QUANTEX_RUN_ID
    else
      process.env.QUANTEX_RUN_ID = previousRunId
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
})
