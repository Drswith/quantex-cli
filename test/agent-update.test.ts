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

  it('resolves managed updates from supported install methods when state is missing', () => {
    const strategy = getAgentUpdateStrategy({
      agent: {
        packages: {
          npm: 'test-pkg',
        },
      },
      installedState: undefined,
      methods: [{ type: 'bun' }],
    })

    expect(strategy).toBe('managed')
  })

  it('does not reclassify recorded unmanaged state through candidate managed methods', () => {
    const provider = resolveAgentUpdateProvider({
      agent: {
        packages: {
          pip: 'test-pkg',
        },
      },
      installedState: {
        installType: 'script',
      },
      methods: [{ command: 'curl https://example.com/install | bash', type: 'script' }, { type: 'pip' }],
    })

    expect(provider.strategy).toBe('manual-hint')
    expect(
      provider.getManagedInstallerType?.({ agent: {}, installedState: undefined, methods: [{ type: 'pip' }] }),
    ).toBe(undefined)
  })

  it('resolves managed updates from cargo install methods', () => {
    const provider = resolveAgentUpdateProvider({
      agent: {
        packages: {
          cargo: 'test-crate',
        },
      },
      installedState: undefined,
      methods: [{ type: 'cargo' }],
    })

    expect(provider.strategy).toBe('managed')
    expect(
      provider.getManagedInstallerType?.({ agent: {}, installedState: undefined, methods: [{ type: 'cargo' }] }),
    ).toBe('cargo')
  })

  it('resolves self-update when only update commands are available', () => {
    const provider = resolveAgentUpdateProvider({
      agent: {
        selfUpdate: {
          command: ['test-agent', 'update'],
        },
      },
      installedState: undefined,
      methods: [{ type: 'script', command: 'curl https://example.com/install | bash' }],
    })

    expect(provider.strategy).toBe('self-update')
  })

  it('falls back to manual-hint when no automatic update path exists', () => {
    const provider = resolveAgentUpdateProvider({
      agent: {},
      installedState: undefined,
      methods: [{ type: 'script', command: 'curl https://example.com/install | bash' }],
    })

    expect(provider.strategy).toBe('manual-hint')
  })
})
