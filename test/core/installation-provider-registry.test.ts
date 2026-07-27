import type { ProviderRegistry } from '../../src/providers/registry'
import type {
  ProviderAdapter,
  ProviderId,
  ProviderOperationContext,
  ProviderOutcome,
  ProviderTarget,
} from '../../src/providers/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCoreInstallationProviderRegistry } from '../../src/core/installation-provider-registry'
import { firstPartyProviderIds } from '../../src/providers/types'

const packageManagers = vi.hoisted(() => ({
  bun: { install: vi.fn(), uninstall: vi.fn() },
  brew: { install: vi.fn(), uninstall: vi.fn() },
  cargo: { install: vi.fn(), uninstall: vi.fn() },
  deno: { install: vi.fn(), uninstall: vi.fn() },
  mise: { install: vi.fn(), uninstall: vi.fn() },
  npm: { install: vi.fn(), uninstall: vi.fn() },
  pip: { install: vi.fn(), uninstall: vi.fn() },
  uv: { install: vi.fn(), uninstall: vi.fn() },
  winget: { install: vi.fn(), uninstall: vi.fn() },
}))

vi.mock('../../src/package-manager/bun', () => ({
  installOutcome: packageManagers.bun.install,
  uninstallOutcome: packageManagers.bun.uninstall,
}))
vi.mock('../../src/package-manager/brew', () => ({
  installOutcome: packageManagers.brew.install,
  uninstallOutcome: packageManagers.brew.uninstall,
}))
vi.mock('../../src/package-manager/cargo', () => ({
  installOutcome: packageManagers.cargo.install,
  uninstallOutcome: packageManagers.cargo.uninstall,
}))
vi.mock('../../src/package-manager/deno', () => ({
  inferDenoBinaryName: (packageName: string, binaryName?: string) =>
    binaryName?.trim() || packageName.trim().split('/').pop()?.replace(/@.*$/u, '') || packageName.trim(),
  installOutcome: packageManagers.deno.install,
  uninstallOutcome: packageManagers.deno.uninstall,
}))
vi.mock('../../src/package-manager/mise', () => ({
  installOutcome: packageManagers.mise.install,
  uninstallOutcome: packageManagers.mise.uninstall,
}))
vi.mock('../../src/package-manager/npm', () => ({
  installOutcome: packageManagers.npm.install,
  uninstallOutcome: packageManagers.npm.uninstall,
}))
vi.mock('../../src/package-manager/pip', () => ({
  installOutcome: packageManagers.pip.install,
  uninstallOutcome: packageManagers.pip.uninstall,
}))
vi.mock('../../src/package-manager/uv', () => ({
  installOutcome: packageManagers.uv.install,
  uninstallOutcome: packageManagers.uv.uninstall,
}))
vi.mock('../../src/package-manager/winget', () => ({
  installOutcome: packageManagers.winget.install,
  uninstallOutcome: packageManagers.winget.uninstall,
}))

const context: ProviderOperationContext = { signal: new AbortController().signal, timeoutMs: 5_000 }
const success: ProviderOutcome<void> = { kind: 'success', value: undefined }

beforeEach(() => {
  for (const manager of Object.values(packageManagers)) {
    manager.install.mockReset().mockResolvedValue(success)
    manager.uninstall.mockReset().mockResolvedValue(success)
  }
})

describe('Core installation provider registry', () => {
  it('reuses observation operations and exposes only the install/ensure capability profile', () => {
    const observations = observationHarness()
    const registry = createCoreInstallationProviderRegistry({ observationRegistry: observations.registry })

    expect(registry.list().map(adapter => adapter.id)).toEqual(firstPartyProviderIds)
    expect(registry.list()).toBe(registry.list())
    for (const id of firstPartyProviderIds) {
      const adapter = registry.get(id)
      expect(adapter?.availability).toBe(observations.adapters.get(id)?.availability)
      expect(adapter?.observe).toBe(observations.adapters.get(id)?.observe)
      expect(adapter).not.toHaveProperty('resolveLatestVersion')
      expect(adapter).not.toHaveProperty('update')
      expect(adapter).not.toHaveProperty('updateMany')
      expect(registry.getCapabilities(id)).toEqual(
        id === 'script' || id === 'binary'
          ? ['availability', 'observe', 'install', 'verify']
          : ['availability', 'observe', 'install', 'uninstall', 'verify'],
      )
    }
  })

  it('maps exact package targets, arguments, cask kind, tag, and registry to named install outcomes', async () => {
    const registry = createCoreInstallationProviderRegistry({ observationRegistry: observationHarness().registry })
    const registryUrl = 'https://registry.example.test'
    const targets = {
      bun: target('bun-tool'),
      brew: target('brew-tool', { kind: 'cask' }),
      cargo: target('cargo-tool', { arguments: ['--locked'] }),
      deno: target('jsr:@scope/deno-tool', { arguments: ['-A'], binaryName: 'deno-tool' }),
      mise: target('npm:mise-tool'),
      npm: target('npm-tool'),
      pip: target('pip-tool'),
      uv: target('uv-tool', { arguments: ['--python', '3.12'] }),
      winget: target('Vendor.WingetTool', { kind: 'id' }),
    } as const

    const results = await Promise.all([
      registry.get('bun')!.install!({
        context,
        options: { distTag: 'beta', registry: `${registryUrl}///` },
        target: targets.bun,
      }),
      registry.get('npm')!.install!({
        context,
        options: { distTag: 'next', registry: `${registryUrl}/` },
        target: targets.npm,
      }),
      registry.get('brew')!.install!({ context, target: targets.brew }),
      registry.get('cargo')!.install!({ context, target: targets.cargo }),
      registry.get('deno')!.install!({ context, target: targets.deno }),
      registry.get('mise')!.install!({ context, target: targets.mise }),
      registry.get('pip')!.install!({ context, target: targets.pip }),
      registry.get('uv')!.install!({ context, target: targets.uv }),
      registry.get('winget')!.install!({ context, target: targets.winget }),
    ])

    expect(packageManagers.bun.install).toHaveBeenCalledWith('bun-tool', 'beta', `${registryUrl}///`, context)
    expect(packageManagers.npm.install).toHaveBeenCalledWith('npm-tool', 'next', `${registryUrl}/`, context)
    expect(packageManagers.brew.install).toHaveBeenCalledWith('brew-tool', 'cask', context)
    expect(packageManagers.cargo.install).toHaveBeenCalledWith('cargo-tool', ['--locked'], context)
    expect(packageManagers.deno.install).toHaveBeenCalledWith('jsr:@scope/deno-tool', ['-A'], context)
    expect(packageManagers.mise.install).toHaveBeenCalledWith('npm:mise-tool', context)
    expect(packageManagers.pip.install).toHaveBeenCalledWith('pip-tool', context)
    expect(packageManagers.uv.install).toHaveBeenCalledWith('uv-tool', ['--python', '3.12'], context)
    expect(packageManagers.winget.install).toHaveBeenCalledWith('Vendor.WingetTool', context)

    expect(commandEvidence(results[0])).toBe(`bun add -g --registry ${registryUrl} bun-tool@beta`)
    expect(commandEvidence(results[1])).toBe(`npm install -g npm-tool@next --registry ${registryUrl}`)
    expect(commandEvidence(results[2])).toBe('brew install --cask brew-tool')
    expect(commandEvidence(results[3])).toBe('cargo install cargo-tool --locked')
    expect(commandEvidence(results[4])).toBe('deno install --global -A jsr:@scope/deno-tool')
    expect(commandEvidence(results[5])).toBe('mise use --global npm:mise-tool')
    expect(commandEvidence(results[6])).toBe('pip install pip-tool')
    expect(commandEvidence(results[7])).toBe('uv tool install uv-tool --python 3.12')
    expect(commandEvidence(results[8])).toBe('winget install --id Vendor.WingetTool -e')
    for (const [index, id] of ['bun', 'npm', 'brew', 'cargo', 'deno', 'mise', 'pip', 'uv', 'winget'].entries()) {
      expect(providerEvidence(results[index])).toBe(id)
    }
  })

  it('limits uninstall to package-provider compensation and preserves exact cask and Deno binary commands', async () => {
    const registry = createCoreInstallationProviderRegistry({ observationRegistry: observationHarness().registry })
    const brew = target('brew-tool', { kind: 'cask' })
    const deno = target('jsr:@scope/deno-tool', { binaryName: 'deno-tool' })

    const [brewResult, denoResult] = await Promise.all([
      registry.get('brew')!.uninstall!({ context, target: brew }),
      registry.get('deno')!.uninstall!({ context, target: deno }),
    ])

    expect(packageManagers.brew.uninstall).toHaveBeenCalledWith('brew-tool', 'cask', context)
    expect(packageManagers.deno.uninstall).toHaveBeenCalledWith('deno-tool', context)
    expect(commandEvidence(brewResult)).toBe('brew uninstall --cask brew-tool')
    expect(commandEvidence(denoResult)).toBe('deno uninstall --global deno-tool')
    expect(registry.get('script')?.uninstall).toBeUndefined()
    expect(registry.get('binary')?.uninstall).toBeUndefined()
  })

  it('uses shell-script and executable effects without adding unmanaged compensation', async () => {
    const executeEffect = vi.fn(async () => success)
    const registry = createCoreInstallationProviderRegistry({
      executeEffect,
      observationRegistry: observationHarness().registry,
      platform: 'linux',
    })
    const script = target('script-tool', {
      effect: { command: 'curl -fsSL https://example.test/install | sh', kind: 'shell-script' },
      kind: 'script',
    })
    const binary = target('binary-tool', {
      effect: { command: ['installer', '--target', 'binary-tool'], kind: 'executable' },
      kind: 'binary',
    })

    const [scriptResult, binaryResult] = await Promise.all([
      registry.get('script')!.install!({ context, target: script }),
      registry.get('binary')!.install!({ context, target: binary }),
    ])

    expect(executeEffect).toHaveBeenNthCalledWith(
      1,
      ['sh', '-c', 'curl -fsSL https://example.test/install | sh'],
      context,
    )
    expect(executeEffect).toHaveBeenNthCalledWith(2, ['installer', '--target', 'binary-tool'], context)
    expect(commandEvidence(scriptResult)).toBe('sh -c curl -fsSL https://example.test/install | sh')
    expect(commandEvidence(binaryResult)).toBe('installer --target binary-tool')
    expect(registry.get('script')?.uninstall).toBeUndefined()
    expect(registry.get('binary')?.uninstall).toBeUndefined()

    const windowsEffect = vi.fn(async () => success)
    const windowsRegistry = createCoreInstallationProviderRegistry({
      executeEffect: windowsEffect,
      observationRegistry: observationHarness().registry,
      platform: 'windows',
    })
    await windowsRegistry.get('script')!.install!({ context, target: script })
    expect(windowsEffect).toHaveBeenCalledWith(
      ['powershell.exe', '-Command', 'curl -fsSL https://example.test/install | sh'],
      context,
    )
  })

  it('adds provider and actual command evidence to failures while preserving interruption outcomes', async () => {
    const registry = createCoreInstallationProviderRegistry({ observationRegistry: observationHarness().registry })
    const failed = {
      command: ['bun', 'pm', '-g', 'trust', 'fixture-tool'],
      evidence: [{ kind: 'package' as const, value: 'fixture-tool@1.0.0' }],
      exitCode: 1,
      kind: 'failed' as const,
      reason: 'bun trust failed',
      retryable: false,
    }
    const cancelled = { kind: 'cancelled' as const, reason: 'stop' }
    const timedOut = { kind: 'timed-out' as const, timeoutMs: 250 }
    packageManagers.bun.install.mockResolvedValueOnce(failed)
    packageManagers.cargo.install.mockResolvedValueOnce(cancelled)
    packageManagers.uv.install.mockResolvedValueOnce(timedOut)

    const failedResult = await registry.get('bun')!.install!({ context, target: target('fixture-tool') })
    const cancelledResult = await registry.get('cargo')!.install!({ context, target: target('cargo-tool') })
    const timedOutResult = await registry.get('uv')!.install!({ context, target: target('uv-tool') })

    expect(failedResult).toEqual({
      ...failed,
      evidence: [
        { kind: 'provider', value: 'bun' },
        { kind: 'command', value: 'bun pm -g trust fixture-tool' },
        { kind: 'package', value: 'fixture-tool@1.0.0' },
      ],
    })
    expect(cancelledResult).toBe(cancelled)
    expect(timedOutResult).toBe(timedOut)
  })

  it('verifies through the reused fresh observation without mutating', async () => {
    const observations = observationHarness()
    const registry = createCoreInstallationProviderRegistry({ observationRegistry: observations.registry })
    const npmTarget = target('npm-tool')
    const observe = observations.adapters.get('npm')!.observe as ReturnType<typeof vi.fn>

    observe
      .mockResolvedValueOnce(observation('present', npmTarget))
      .mockResolvedValueOnce(observation('absent', npmTarget))
    await expect(registry.get('npm')!.verify!({ context, target: npmTarget })).resolves.toEqual({
      kind: 'success',
      value: {
        evidence: [{ kind: 'package', value: 'npm:npm-tool:present' }],
        kind: 'satisfied',
      },
    })
    await expect(registry.get('npm')!.verify!({ context, target: npmTarget })).resolves.toEqual({
      kind: 'success',
      value: {
        evidence: [{ kind: 'package', value: 'npm:npm-tool:absent' }],
        kind: 'unsatisfied',
        reason: 'npm-tool is not installed through npm',
      },
    })
    expect(packageManagers.npm.install).not.toHaveBeenCalled()
    expect(packageManagers.npm.uninstall).not.toHaveBeenCalled()
  })
})

function observationHarness(): {
  readonly adapters: ReadonlyMap<ProviderId, ProviderAdapter>
  readonly registry: ProviderRegistry
} {
  const adapters = new Map<ProviderId, ProviderAdapter>(
    firstPartyProviderIds.map(id => {
      const adapter: ProviderAdapter = {
        availability: vi.fn(async () => ({ kind: 'success' as const, value: { executable: id } })),
        id,
        observe: vi.fn(async ({ target: providerTarget }) => observation('present', providerTarget)),
      }
      return [id, adapter]
    }),
  )
  return {
    adapters,
    registry: {
      get: id => adapters.get(id),
      getCapabilities: id => (adapters.has(id) ? ['availability', 'observe'] : []),
      list: () => [...adapters.values()],
    },
  }
}

function observation(kind: 'absent' | 'present', providerTarget: ProviderTarget) {
  return {
    kind: 'success' as const,
    value: {
      evidence: [
        { kind: 'package' as const, value: `${providerTargetKind(providerTarget)}:${providerTarget.id}:${kind}` },
      ],
      kind,
      target: providerTarget,
    },
  }
}

function providerTargetKind(providerTarget: ProviderTarget): ProviderId {
  return firstPartyProviderIds.find(id => id === providerTarget.kind) ?? 'npm'
}

function target(id: string, overrides: Partial<Omit<ProviderTarget, 'id'>> = {}): ProviderTarget {
  return { id, kind: 'package', ...overrides }
}

function commandEvidence(outcome: Awaited<ReturnType<NonNullable<ProviderAdapter['install']>>>): string | undefined {
  return outcome.kind === 'success' ? outcome.value.evidence.find(item => item.kind === 'command')?.value : undefined
}

function providerEvidence(outcome: Awaited<ReturnType<NonNullable<ProviderAdapter['install']>>>): string | undefined {
  return outcome.kind === 'success' ? outcome.value.evidence.find(item => item.kind === 'provider')?.value : undefined
}
