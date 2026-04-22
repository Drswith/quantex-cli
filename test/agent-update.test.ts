import { describe, expect, it } from 'vitest'
import { getAgentUpdateStrategy, resolveAgentUpdateProvider } from '../src/agent-update'

describe('agent update providers', () => {
  it('resolves managed updates from installed managed state', () => {
    const strategy = getAgentUpdateStrategy({
      agent: {},
      installedState: {
        installType: 'bun',
        packageName: 'test-pkg',
      },
      methods: [{ type: 'bun' }],
    })

    expect(strategy).toBe('managed')
  })

  it('resolves self-update when only update commands are available', () => {
    const provider = resolveAgentUpdateProvider({
      agent: {
        selfUpdate: {
          command: ['test-agent', 'update'],
        },
      },
      installedState: undefined,
      methods: [{ type: 'script' }],
    })

    expect(provider.strategy).toBe('self-update')
  })

  it('falls back to manual-hint when no automatic update path exists', () => {
    const provider = resolveAgentUpdateProvider({
      agent: {},
      installedState: undefined,
      methods: [{ type: 'script' }],
    })

    expect(provider.strategy).toBe('manual-hint')
  })
})
