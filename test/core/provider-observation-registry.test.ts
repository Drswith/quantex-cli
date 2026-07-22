import type { CoreProviderObservationDependencies } from '../../src/core/provider-observation-registry'
import type { ProviderId, ProviderTarget } from '../../src/providers/types'
import { describe, expect, it, vi } from 'vitest'
import { createCoreProviderObservationRegistry } from '../../src/core/provider-observation-registry'

const targets: Record<ProviderId, ProviderTarget> = {
  binary: { binaryName: 'fixture', id: 'fixture', kind: 'binary' },
  brew: { id: 'fixture', kind: 'formula' },
  bun: { id: 'fixture', kind: 'package' },
  cargo: { id: 'fixture', kind: 'package' },
  deno: { binaryName: 'fixture', id: 'jsr:@scope/fixture', kind: 'tool' },
  mise: { id: 'npm:fixture', kind: 'tool' },
  npm: { id: 'fixture', kind: 'package' },
  pip: { id: 'fixture', kind: 'package' },
  script: { binaryName: 'fixture', id: 'https://example.com/install.sh', kind: 'script' },
  uv: { id: 'fixture', kind: 'tool' },
  winget: { id: 'Example.Fixture', kind: 'id' },
}

describe('Core provider observation registry', () => {
  it.each([
    ['bun', 'fixture@1.2.3\n'],
    ['npm', '{"dependencies":{"fixture":{"version":"1.2.3"}}}\n'],
    ['brew', 'fixture 1.2.3\n'],
    ['cargo', 'fixture v1.2.3:\n'],
    ['mise', '{"npm:fixture":[{"version":"1.2.3"}]}\n'],
    ['pip', 'Version: 1.2.3\n'],
    ['uv', 'fixture v1.2.3\n'],
    ['winget', 'Name  Id  Version\nFixture  Example.Fixture  1.2.3\n'],
  ] as const)('observes %s package provenance without mutation methods', async (id, stdout) => {
    const runCommand = vi.fn(async (argv: readonly string[]) => ({
      exitCode: 0,
      stderr: '',
      stdout: id === 'pip' && argv.at(-1) === '--version' ? 'pip 25.0\n' : stdout,
    }))
    const registry = createCoreProviderObservationRegistry(dependencies({ runCommand }))
    const adapter = registry.get(id)

    const outcome = await adapter!.observe({ context: context(), target: targets[id] })

    expect(outcome).toMatchObject({ kind: 'success', value: { kind: 'present', version: '1.2.3' } })
    expect(Object.keys(adapter!).sort()).toEqual(['availability', 'id', 'observe'])
    expect(registry.getCapabilities(id)).toEqual(['availability', 'observe'])
  })

  it('uses a filesystem-only Deno ownership probe', async () => {
    const access = vi.fn(async () => undefined)
    const runCommand = vi.fn(async () => ({ exitCode: 1, stderr: '', stdout: '' }))
    const registry = createCoreProviderObservationRegistry(dependencies({ access, runCommand }))

    const outcome = await registry.get('deno')!.observe({ context: context(), target: targets.deno })

    expect(outcome).toMatchObject({ kind: 'success', value: { kind: 'present' } })
    expect(access).toHaveBeenCalledWith('/fixture-home/.deno/bin/fixture')
    expect(runCommand).not.toHaveBeenCalled()
  })

  it.each(['binary', 'script'] as const)('probes %s sources only by declared executable presence', async id => {
    const runCommand = vi.fn(async () => ({ exitCode: 0, stderr: '', stdout: '/bin/fixture\n' }))
    const registry = createCoreProviderObservationRegistry(dependencies({ runCommand }))

    const outcome = await registry.get(id)!.observe({ context: context(), target: targets[id] })

    expect(outcome).toMatchObject({ kind: 'success', value: { kind: 'present' } })
    expect(runCommand).toHaveBeenCalledWith(
      ['which', 'fixture'],
      expect.objectContaining({ signal: expect.anything() }),
    )
  })

  it('fails closed when a package probe cannot establish presence', async () => {
    const registry = createCoreProviderObservationRegistry(
      dependencies({ runCommand: async () => ({ exitCode: 1, stderr: 'unexpected', stdout: '' }) }),
    )

    const outcome = await registry.get('brew')!.observe({ context: context(), target: targets.brew })

    expect(outcome).toMatchObject({ kind: 'indeterminate', reason: expect.stringContaining('could not determine') })
  })
})

function dependencies(overrides: Partial<CoreProviderObservationDependencies>): CoreProviderObservationDependencies {
  return {
    access: async () => undefined,
    env: {},
    homeDir: () => '/fixture-home',
    platform: 'darwin',
    readFile: async () => '{}',
    runCommand: async () => ({ exitCode: 1, stderr: '', stdout: '' }),
    ...overrides,
  }
}

function context() {
  return { signal: new AbortController().signal }
}
