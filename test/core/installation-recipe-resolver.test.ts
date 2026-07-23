import type { AgentDefinition, InstallMethod } from '../../src/agents/types'
import type { CoreInstallationDirective } from '../../src/core/installation-decision'
import type { CoreMutationRecipe, CoreMutationRecipeCatalog } from '../../src/core/mutation-recipe-catalog'
import type { CoreAgentObservation } from '../../src/core/production-observation'
import type { LifecycleReceipt } from '../../src/lifecycle/model'
import type { LifecycleProviderBinding } from '../../src/lifecycle/provider-binding'
import type {
  ProviderAdapter,
  ProviderAvailability,
  ProviderId,
  ProviderObservation,
  ProviderOutcome,
  ProviderTarget,
} from '../../src/providers/types'
import type { InstalledAgentState } from '../../src/state/schema'
import { describe, expect, it, vi } from 'vitest'
import { resolveCoreInstallationRecipe } from '../../src/core/installation-recipe-resolver'
import { resolveReceiptProviderBinding, resolveStateProviderBinding } from '../../src/lifecycle/provider-binding'
import { createProviderRegistry } from '../../src/providers/registry'

const context = Object.freeze({ signal: new AbortController().signal, timeoutMs: 1_000 })

describe('Core installation recipe resolver', () => {
  it('matches generated recipes in the preferred observed method order', async () => {
    const methods: InstallMethod[] = [
      { packageName: '@fixture/agent', type: 'bun' },
      { packageName: '@fixture/agent', type: 'npm' },
    ]
    const observed = missingObservation(methods)
    const npm = fakeAdapter('npm')
    const bun = fakeAdapter('bun')

    const result = await resolve(observed, installDirective(), [packageRecipe('npm'), packageRecipe('bun')], [npm, bun])

    expect(result).toMatchObject({ kind: 'ready', recipe: { binding: { providerId: 'bun' } } })
    expect(bun.availability).toHaveBeenCalledTimes(1)
    expect(bun.observe).toHaveBeenCalledTimes(1)
    expect(npm.availability).not.toHaveBeenCalled()
  })

  it('falls back only when an earlier provider is explicitly unavailable', async () => {
    const observed = missingObservation([
      { packageName: '@fixture/agent', type: 'bun' },
      { packageName: '@fixture/agent', type: 'npm' },
    ])
    const bun = fakeAdapter('bun', {
      availability: { kind: 'unavailable', reason: 'bun is not installed', retryable: false },
    })
    const npm = fakeAdapter('npm')

    const result = await resolve(observed, installDirective(), [packageRecipe('bun'), packageRecipe('npm')], [bun, npm])

    expect(result).toMatchObject({ kind: 'ready', recipe: { binding: { providerId: 'npm' } } })
    expect(bun.observe).not.toHaveBeenCalled()
    expect(npm.observe).toHaveBeenCalledTimes(1)
  })

  it.each([
    {
      label: 'indeterminate observation',
      outcome: { kind: 'indeterminate', reason: 'package presence is unknown' } as const,
    },
    {
      label: 'failed observation',
      outcome: { kind: 'failed', reason: 'probe rejected', retryable: true } as const,
    },
  ])('fails closed without fallback after $label', async ({ outcome }) => {
    const observed = missingObservation([
      { packageName: '@fixture/agent', type: 'bun' },
      { packageName: '@fixture/agent', type: 'npm' },
    ])
    const bun = fakeAdapter('bun', { observation: outcome })
    const npm = fakeAdapter('npm')

    const result = await resolve(observed, installDirective(), [packageRecipe('bun'), packageRecipe('npm')], [bun, npm])

    expect(result.kind).toBe('blocked')
    expect(npm.availability).not.toHaveBeenCalled()
    expect(npm.observe).not.toHaveBeenCalled()
  })

  it('fails closed when the selected target becomes present before mutation', async () => {
    const observed = missingObservation([{ packageName: '@fixture/agent', type: 'bun' }])
    const bun = fakeAdapter('bun', { present: true })

    const result = await resolve(observed, installDirective(), [packageRecipe('bun')], [bun])

    expect(result).toMatchObject({ kind: 'blocked', retryable: true })
  })

  it('fails closed when absence evidence changes the selected install arguments', async () => {
    const method: InstallMethod = {
      packageInstallArgs: ['--locked'],
      packageName: 'fixture-agent',
      type: 'cargo',
    }
    const observed = missingObservation([method])
    const cargo = fakeAdapter('cargo', {
      observationTarget: { arguments: ['--different'], id: 'fixture-agent', kind: 'package' },
    })
    const result = await resolve(
      observed,
      installDirective(),
      [{ provider: 'cargo', target: { arguments: ['--locked'], id: 'fixture-agent', kind: 'package' } }],
      [cargo],
    )

    expect(result).toMatchObject({ kind: 'blocked', retryable: false })
  })

  it.each([
    { outcome: { kind: 'cancelled', reason: 'caller cancelled' } as const },
    { outcome: { kind: 'timed-out', timeoutMs: 25 } as const },
  ])('passes through provider interruption $outcome.kind', async ({ outcome }) => {
    const observed = missingObservation([{ packageName: '@fixture/agent', type: 'bun' }])
    const bun = fakeAdapter('bun', { availability: outcome })

    const result = await resolve(observed, installDirective(), [packageRecipe('bun')], [bun])

    expect(result).toEqual({ kind: 'interrupted', outcome })
  })

  it('projects a thrown typed provider interruption instead of blocking', async () => {
    const observed = missingObservation([{ packageName: '@fixture/agent', type: 'bun' }])
    const bun = fakeAdapter('bun', { availabilityError: { kind: 'timed-out', timeoutMs: 40 } })

    const result = await resolve(observed, installDirective(), [packageRecipe('bun')], [bun])

    expect(result).toEqual({ kind: 'interrupted', outcome: { kind: 'timed-out', timeoutMs: 40 } })
  })

  it('requires install and verify before probing and does not fall back for a broken adapter', async () => {
    const observed = missingObservation([
      { packageName: '@fixture/agent', type: 'bun' },
      { packageName: '@fixture/agent', type: 'npm' },
    ])
    const bun = fakeAdapter('bun', { verify: false })
    const npm = fakeAdapter('npm')

    const result = await resolve(observed, installDirective(), [packageRecipe('bun'), packageRecipe('npm')], [bun, npm])

    expect(result).toMatchObject({ kind: 'blocked', retryable: false })
    expect(bun.availability).not.toHaveBeenCalled()
    expect(npm.availability).not.toHaveBeenCalled()
  })

  it('selects only the exact stale source, including ordered install arguments', async () => {
    const installedState: InstalledAgentState = {
      agentName: 'fixture-agent',
      installType: 'cargo',
      packageInstallArgs: ['--locked', '--features', 'cli'],
      packageName: 'fixture-agent',
    }
    const observed = staleObservation(installedState)
    const cargo = fakeAdapter('cargo')
    const npm = fakeAdapter('npm')
    const result = await resolve(
      observed,
      reinstallDirective(observed),
      [
        packageRecipe('npm'),
        {
          provider: 'cargo',
          target: {
            arguments: ['--locked', '--features', 'cli'],
            id: 'fixture-agent',
            kind: 'package',
          },
        },
      ],
      [npm, cargo],
    )

    expect(result).toMatchObject({
      kind: 'ready',
      recipe: {
        binding: {
          providerId: 'cargo',
          target: { arguments: ['--locked', '--features', 'cli'] },
        },
        compensation: 'provider-uninstall',
        installedState,
      },
    })
    expect(npm.availability).not.toHaveBeenCalled()
  })

  it('normalizes empty generated arguments to an absent v1 state field', async () => {
    const observed = missingObservation([{ packageName: '@fixture/agent', type: 'npm' }])
    const npm = fakeAdapter('npm')
    const source: CoreMutationRecipe = {
      provider: 'npm',
      target: { arguments: [], id: '@fixture/agent', kind: 'package' },
    }

    const result = await resolve(observed, installDirective(), [source], [npm])

    expect(result).toMatchObject({ kind: 'ready', recipe: { installedState: { installType: 'npm' } } })
    if (result.kind !== 'ready') throw new Error('Expected a ready recipe.')
    expect(result.recipe.binding.target.arguments).toBeUndefined()
    expect(result.recipe.installedState.packageInstallArgs).toBeUndefined()
  })

  it('blocks stale reinstall when exact arguments changed in the catalog', async () => {
    const installedState: InstalledAgentState = {
      agentName: 'fixture-agent',
      installType: 'cargo',
      packageInstallArgs: ['--locked'],
      packageName: 'fixture-agent',
    }
    const observed = staleObservation(installedState)
    const cargo = fakeAdapter('cargo')

    const result = await resolve(
      observed,
      reinstallDirective(observed),
      [
        {
          provider: 'cargo',
          target: { arguments: ['--features', 'cli'], id: 'fixture-agent', kind: 'package' },
        },
      ],
      [cargo],
    )

    expect(result.kind).toBe('blocked')
    expect(cargo.availability).not.toHaveBeenCalled()
  })

  it('never switches a stale reinstall to another provider', async () => {
    const installedState: InstalledAgentState = {
      agentName: 'fixture-agent',
      installType: 'npm',
      packageName: '@fixture/agent',
    }
    const observed = staleObservation(installedState)
    const npm = fakeAdapter('npm', {
      availability: { kind: 'unavailable', reason: 'npm unavailable', retryable: true },
    })
    const bun = fakeAdapter('bun')

    const result = await resolve(
      observed,
      reinstallDirective(observed),
      [packageRecipe('bun'), packageRecipe('npm')],
      [bun, npm],
    )

    expect(result.kind).toBe('blocked')
    expect(bun.availability).not.toHaveBeenCalled()
  })

  it('rejects stale state and receipt conflicts before provider probing', async () => {
    const installedState: InstalledAgentState = {
      agentName: 'fixture-agent',
      installType: 'npm',
      packageName: '@fixture/agent',
    }
    const observed = staleObservation(installedState, {
      ...receiptFor(installedState),
      providerId: 'bun',
    })
    const npm = fakeAdapter('npm')

    const result = await resolve(observed, reinstallDirectiveFromState(observed), [packageRecipe('npm')], [npm])

    expect(result.kind).toBe('blocked')
    expect(npm.availability).not.toHaveBeenCalled()
  })

  it('projects shell-script effects to the v1 command identity with manual compensation', async () => {
    const command = 'curl -fsSL https://example.com/install.sh | bash'
    const method: InstallMethod = { command, type: 'script' }
    const observed = missingObservation([method])
    const script = fakeAdapter('script')
    const source: CoreMutationRecipe = {
      provider: 'script',
      target: {
        effect: { command, kind: 'shell-script' },
        id: 'https://example.com/install.sh',
        kind: 'script',
      },
    }

    const result = await resolve(observed, installDirective(), [source], [script])

    expect(result).toMatchObject({
      kind: 'ready',
      recipe: {
        binding: {
          providerId: 'script',
          target: {
            binaryName: 'fixture',
            effect: { command, kind: 'shell-script' },
            id: command,
          },
        },
        compensation: 'manual',
        installedState: { agentName: 'fixture-agent', command, installType: 'script' },
      },
    })
  })

  it('renders executable-effect argv exactly for binary state identity', async () => {
    const command = 'fixture-installer --output "path with spaces"'
    const method: InstallMethod = { command, type: 'binary' }
    const observed = missingObservation([method])
    const binary = fakeAdapter('binary')
    const source: CoreMutationRecipe = {
      provider: 'binary',
      target: {
        effect: {
          command: ['fixture-installer', '--output', 'path with spaces'],
          kind: 'executable',
        },
        id: 'https://example.com/fixture-installer',
        kind: 'binary',
      },
    }

    const result = await resolve(observed, installDirective(), [source], [binary])

    expect(result).toMatchObject({
      kind: 'ready',
      recipe: {
        binding: {
          providerId: 'binary',
          target: {
            binaryName: 'fixture',
            effect: {
              command: ['fixture-installer', '--output', 'path with spaces'],
              kind: 'executable',
            },
            id: command,
          },
        },
        compensation: 'manual',
        installedState: { command, installType: 'binary' },
      },
    })
  })
})

function resolve(
  observed: CoreAgentObservation,
  directive: Extract<CoreInstallationDirective, { readonly wouldChange: true }>,
  recipes: readonly CoreMutationRecipe[],
  providers: readonly FakeAdapter[],
) {
  const catalog: CoreMutationRecipeCatalog = [{ name: observed.agent.name, platforms: { linux: recipes } }]
  return resolveCoreInstallationRecipe({
    catalog,
    context,
    directive,
    observed,
    operation: 'install',
    platform: 'linux',
    providerRegistry: createProviderRegistry(providers.map(provider => provider.adapter)),
  })
}

function missingObservation(methods: readonly InstallMethod[]): CoreAgentObservation {
  const agent = fixtureAgent(methods)
  return {
    agent,
    capabilities: [],
    catalogMethods: [],
    executable: { present: false },
    methods,
    observation: { drift: { kind: 'none' }, kind: 'absent', targetId: agent.name },
    pathExecutable: { present: false },
  }
}

function staleObservation(
  installedState: InstalledAgentState,
  receipt = receiptFor(installedState),
): CoreAgentObservation {
  const method = stateMethod(installedState)
  const agent = fixtureAgent([method])
  const stateBinding = resolveStateProviderBinding(agent, installedState)
  const receiptBinding = resolveReceiptProviderBinding(receipt)
  if (!stateBinding || !receiptBinding) throw new Error('Fixture evidence did not resolve.')
  return {
    agent,
    binding: receiptBinding,
    capabilities: [],
    catalogMethods: [],
    executable: { present: false },
    installedState,
    methods: [method],
    observation: { drift: { kind: 'recorded-absent' }, kind: 'absent', targetId: agent.name },
    pathExecutable: { present: false },
    persistedBinding: receiptBinding,
    receipt,
  }
}

function fixtureAgent(methods: readonly InstallMethod[]): AgentDefinition {
  return {
    binaryName: 'fixture',
    displayName: 'Fixture Agent',
    homepage: 'https://example.com/fixture',
    name: 'fixture-agent',
    packages: {
      cargo: 'fixture-agent',
      deno: 'fixture-agent',
      mise: 'fixture-agent',
      npm: '@fixture/agent',
      pip: 'fixture-agent',
      uv: 'fixture-agent',
    },
    platforms: { linux: [...methods] },
  }
}

function stateMethod(state: InstalledAgentState): InstallMethod {
  if (state.installType === 'script' || state.installType === 'binary') {
    if (!state.command) throw new Error('Effect fixture requires a command.')
    return {
      ...(state.binaryName ? { binaryName: state.binaryName } : {}),
      command: state.command,
      type: state.installType,
    }
  }
  return {
    ...(state.binaryName ? { binaryName: state.binaryName } : {}),
    ...(state.packageInstallArgs ? { packageInstallArgs: state.packageInstallArgs } : {}),
    ...(state.packageName ? { packageName: state.packageName } : {}),
    ...(state.packageTargetKind ? { packageTargetKind: state.packageTargetKind } : {}),
    type: state.installType,
  }
}

function receiptFor(state: InstalledAgentState): LifecycleReceipt {
  const agent = fixtureAgent([stateMethod(state)])
  const binding = resolveStateProviderBinding(agent, state)
  if (!binding) throw new Error('Fixture state did not resolve.')
  return {
    ...(binding.target.binaryName ? { executableName: binding.target.binaryName } : {}),
    kind: 'lifecycle-receipt',
    providerId: binding.providerId,
    providerTargetId: binding.target.id,
    providerTargetKind: binding.target.kind,
    schemaVersion: 1,
    targetId: state.agentName,
    verifiedAt: '2026-07-23T00:00:00.000Z',
  }
}

function installDirective(): Extract<CoreInstallationDirective, { readonly decision: 'install' }> {
  return { decision: 'install', kind: 'ready', wouldChange: true }
}

function reinstallDirective(
  observed: CoreAgentObservation,
): Extract<CoreInstallationDirective, { readonly decision: 'reinstall' }> {
  if (!observed.persistedBinding) throw new Error('Fixture requires persisted binding.')
  return { decision: 'reinstall', kind: 'ready', requiredBinding: observed.persistedBinding, wouldChange: true }
}

function reinstallDirectiveFromState(
  observed: CoreAgentObservation,
): Extract<CoreInstallationDirective, { readonly decision: 'reinstall' }> {
  if (!observed.installedState) throw new Error('Fixture requires installed state.')
  const requiredBinding = resolveStateProviderBinding(observed.agent, observed.installedState)
  if (!requiredBinding) throw new Error('Fixture state did not resolve.')
  return { decision: 'reinstall', kind: 'ready', requiredBinding, wouldChange: true }
}

function packageRecipe(provider: Extract<ProviderId, 'bun' | 'npm'>): CoreMutationRecipe {
  return { provider, target: { id: '@fixture/agent', kind: 'package' } }
}

interface FakeAdapter {
  readonly adapter: ProviderAdapter
  readonly availability: ReturnType<typeof vi.fn<ProviderAdapter['availability']>>
  readonly observe: ReturnType<typeof vi.fn<ProviderAdapter['observe']>>
}

interface FakeAdapterOptions {
  readonly availability?: ProviderOutcome<ProviderAvailability>
  readonly availabilityError?: unknown
  readonly install?: boolean
  readonly observation?: Exclude<ProviderOutcome<ProviderObservation>, { readonly kind: 'success' }>
  readonly observationTarget?: ProviderTarget
  readonly present?: boolean
  readonly verify?: boolean
}

function fakeAdapter(id: ProviderId, options: FakeAdapterOptions = {}): FakeAdapter {
  const availability = vi.fn<ProviderAdapter['availability']>(async () => {
    if (options.availabilityError !== undefined) throw options.availabilityError
    return options.availability ?? { kind: 'success', value: { executable: id } }
  })
  const observe = vi.fn<ProviderAdapter['observe']>(
    async request =>
      options.observation ?? {
        kind: 'success',
        value: {
          kind: options.present ? 'present' : 'absent',
          target: options.observationTarget ?? request.target,
        },
      },
  )
  return {
    adapter: {
      availability,
      id,
      ...(options.install === false
        ? {}
        : {
            install: async request => ({ kind: 'success', value: { evidence: [], target: request.target } }),
          }),
      observe,
      uninstall: async request => ({ kind: 'success', value: { evidence: [], target: request.target } }),
      ...(options.verify === false
        ? {}
        : {
            verify: async () => ({ kind: 'success', value: { evidence: [], kind: 'satisfied' } }),
          }),
    },
    availability,
    observe,
  }
}
