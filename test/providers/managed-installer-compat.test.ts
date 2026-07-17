import { afterEach, describe, expect, it, vi } from 'vitest'
import * as brewPm from '../../src/package-manager/brew'
import * as bunPm from '../../src/package-manager/bun'
import * as cargoPm from '../../src/package-manager/cargo'
import * as denoPm from '../../src/package-manager/deno'
import { getManagedInstaller } from '../../src/package-manager/installers'
import * as misePm from '../../src/package-manager/mise'
import * as npmPm from '../../src/package-manager/npm'
import * as uvPm from '../../src/package-manager/uv'
import * as wingetPm from '../../src/package-manager/winget'
import { brewProviderAdapter } from '../../src/providers/adapters/brew'
import { bunProviderAdapter } from '../../src/providers/adapters/bun'
import { cargoProviderAdapter } from '../../src/providers/adapters/cargo'
import { denoProviderAdapter } from '../../src/providers/adapters/deno'
import { miseProviderAdapter } from '../../src/providers/adapters/mise'
import { npmProviderAdapter } from '../../src/providers/adapters/npm'
import { pipProviderAdapter } from '../../src/providers/adapters/pip'
import { uvProviderAdapter } from '../../src/providers/adapters/uv'
import { wingetProviderAdapter } from '../../src/providers/adapters/winget'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('managed installer typed provider compatibility', () => {
  it('routes npm updates through the typed adapter and preserves strategy options', async () => {
    const update = vi.spyOn(npmProviderAdapter, 'update').mockResolvedValue({
      kind: 'success',
      value: {
        evidence: [{ kind: 'provider', value: 'npm' }],
        target: { id: '@example/npm-agent', kind: 'package' },
      },
    })

    expect(
      await getManagedInstaller('npm').update('@example/npm-agent', undefined, {
        npmBunUpdateStrategy: 'respect-semver',
      }),
    ).toBe(true)
    expect(update).toHaveBeenCalledWith({
      context: expect.objectContaining({ signal: expect.any(AbortSignal) }),
      options: { updateStrategy: 'respect-semver' },
      target: { id: '@example/npm-agent', kind: 'package' },
    })
  })

  it('projects typed Bun failure to the maintained boolean result', async () => {
    const install = vi.spyOn(bunProviderAdapter, 'install').mockResolvedValue({
      command: ['bun', 'add', '-g', '@example/bun-agent'],
      kind: 'failed',
      reason: 'fixture failure',
      retryable: false,
    })

    expect(await getManagedInstaller('bun').install('@example/bun-agent')).toBe(false)
    expect(install).toHaveBeenCalledWith({
      context: expect.objectContaining({ signal: expect.any(AbortSignal) }),
      target: { id: '@example/bun-agent', kind: 'package' },
    })
  })

  it('routes batch targets through the typed npm adapter without losing identity', async () => {
    const updateMany = vi.spyOn(npmProviderAdapter, 'updateMany').mockResolvedValue({
      kind: 'success',
      value: [],
    })

    expect(
      await getManagedInstaller('npm').updateMany(
        [{ packageName: '@example/one' }, { packageInstallArgs: ['--locked'], packageName: '@example/two' }],
        { npmBunUpdateStrategy: 'latest-major' },
      ),
    ).toBe(true)
    expect(updateMany).toHaveBeenCalledWith({
      context: expect.objectContaining({ signal: expect.any(AbortSignal) }),
      options: { updateStrategy: 'latest-major' },
      targets: [
        { id: '@example/one', kind: 'package' },
        { arguments: ['--locked'], id: '@example/two', kind: 'package' },
      ],
    })
  })

  it('keeps legacy presence and installed-version probes as direct compatibility projections', async () => {
    const npmVersion = vi.spyOn(npmPm, 'getInstalledVersion').mockResolvedValue('1.2.3')
    const bunPresence = vi.spyOn(bunPm, 'probePackagePresence').mockResolvedValue('absent')
    const brewPresence = vi.spyOn(brewPm, 'probePackagePresence').mockResolvedValue('absent')
    const brewVersion = vi.spyOn(brewPm, 'getInstalledVersion').mockResolvedValue('1.2.3')

    expect(await getManagedInstaller('npm').getInstalledVersion?.('@example/npm-agent')).toBe('1.2.3')
    expect(await getManagedInstaller('bun').probePackagePresence?.('@example/bun-agent')).toBe('absent')
    expect(await getManagedInstaller('brew').probePackagePresence?.('example-formula', 'package')).toBe('absent')
    expect(await getManagedInstaller('brew').getInstalledVersion?.('example-cask', 'cask')).toBe('1.2.3')
    expect(npmVersion).toHaveBeenCalledWith('@example/npm-agent')
    expect(bunPresence).toHaveBeenCalledWith('@example/bun-agent')
    expect(brewPresence).toHaveBeenCalledWith('example-formula', 'package')
    expect(brewVersion).toHaveBeenCalledWith('example-cask', 'cask')
  })

  it('binds Homebrew cask identity once when routing through the typed adapter', async () => {
    const install = vi.spyOn(brewProviderAdapter, 'install').mockResolvedValue({
      kind: 'success',
      value: { evidence: [], target: { id: 'example-cask', kind: 'cask' } },
    })

    expect(await getManagedInstaller('brew').install('example-cask', 'cask')).toBe(true)
    expect(install).toHaveBeenCalledWith({
      context: expect.objectContaining({ signal: expect.any(AbortSignal) }),
      target: { id: 'example-cask', kind: 'cask' },
    })
  })

  it('binds winget package IDs when routing through the typed adapter', async () => {
    const update = vi.spyOn(wingetProviderAdapter, 'update').mockResolvedValue({
      kind: 'success',
      value: { evidence: [], target: { id: 'Example.Package', kind: 'id' } },
    })

    expect(await getManagedInstaller('winget').update('Example.Package', 'id')).toBe(true)
    expect(update).toHaveBeenCalledWith({
      context: expect.objectContaining({ signal: expect.any(AbortSignal) }),
      target: { id: 'Example.Package', kind: 'id' },
    })
  })

  it('preserves Cargo update arguments when routing through the typed adapter', async () => {
    const update = vi.spyOn(cargoProviderAdapter, 'update').mockResolvedValue({
      kind: 'success',
      value: { evidence: [], target: { arguments: ['--locked'], id: 'some-crate', kind: 'package' } },
    })

    expect(
      await getManagedInstaller('cargo').update('some-crate', undefined, {
        packageInstallArgs: ['--locked'],
      }),
    ).toBe(true)
    expect(update).toHaveBeenCalledWith({
      context: expect.objectContaining({ signal: expect.any(AbortSignal) }),
      target: { arguments: ['--locked'], id: 'some-crate', kind: 'package' },
    })
  })

  it('preserves the Deno executable name when routing uninstall through the typed adapter', async () => {
    const uninstall = vi.spyOn(denoProviderAdapter, 'uninstall').mockResolvedValue({
      kind: 'success',
      value: { evidence: [], target: { binaryName: 'tool-bin', id: 'jsr:@scope/tool', kind: 'tool' } },
    })

    expect(
      await getManagedInstaller('deno').uninstall('jsr:@scope/tool', undefined, {
        binaryName: 'tool-bin',
      }),
    ).toBe(true)
    expect(uninstall).toHaveBeenCalledWith({
      context: expect.objectContaining({ signal: expect.any(AbortSignal) }),
      target: { binaryName: 'tool-bin', id: 'jsr:@scope/tool', kind: 'tool' },
    })
  })

  it('routes pip, uv, and mise mutations through typed adapters without losing target semantics', async () => {
    const pipInstall = vi.spyOn(pipProviderAdapter, 'install').mockResolvedValue({
      kind: 'success',
      value: { evidence: [], target: { id: 'example-pkg', kind: 'package' } },
    })
    const uvUpdate = vi.spyOn(uvProviderAdapter, 'update').mockResolvedValue({
      kind: 'success',
      value: { evidence: [], target: { arguments: ['--python', '3.12'], id: 'example-tool', kind: 'tool' } },
    })
    const miseUpdate = vi.spyOn(miseProviderAdapter, 'update').mockResolvedValue({
      kind: 'success',
      value: { evidence: [], target: { id: 'npm:@openai/codex', kind: 'tool' } },
    })

    expect(await getManagedInstaller('pip').install('example-pkg')).toBe(true)
    expect(
      await getManagedInstaller('uv').update('example-tool', undefined, {
        packageInstallArgs: ['--python', '3.12'],
      }),
    ).toBe(true)
    expect(await getManagedInstaller('mise').update('npm:@openai/codex')).toBe(true)
    expect(pipInstall).toHaveBeenCalledWith({
      context: expect.objectContaining({ signal: expect.any(AbortSignal) }),
      target: { id: 'example-pkg', kind: 'package' },
    })
    expect(uvUpdate).toHaveBeenCalledWith({
      context: expect.objectContaining({ signal: expect.any(AbortSignal) }),
      target: { arguments: ['--python', '3.12'], id: 'example-tool', kind: 'tool' },
    })
    expect(miseUpdate).toHaveBeenCalledWith({
      context: expect.objectContaining({ signal: expect.any(AbortSignal) }),
      target: { id: 'npm:@openai/codex', kind: 'tool' },
    })
  })

  it('keeps default Homebrew and winget dependencies on typed low-level outcomes', async () => {
    const brewInstall = vi.spyOn(brewPm, 'installOutcome').mockResolvedValue({ kind: 'success', value: undefined })
    const wingetUpdate = vi.spyOn(wingetPm, 'updateOutcome').mockResolvedValue({ kind: 'success', value: undefined })

    expect(await getManagedInstaller('brew').install('example-cask', 'cask')).toBe(true)
    expect(await getManagedInstaller('winget').update('Example.Package', 'id')).toBe(true)
    expect(brewInstall).toHaveBeenCalledWith('example-cask', 'cask', expect.any(Object))
    expect(wingetUpdate).toHaveBeenCalledWith('Example.Package', expect.any(Object))
  })

  it('keeps default Cargo and Deno dependencies on typed low-level outcomes', async () => {
    const cargoUpdate = vi.spyOn(cargoPm, 'updateOutcome').mockResolvedValue({ kind: 'success', value: undefined })
    const denoUninstall = vi.spyOn(denoPm, 'uninstallOutcome').mockResolvedValue({ kind: 'success', value: undefined })

    expect(
      await getManagedInstaller('cargo').update('some-crate', undefined, {
        packageInstallArgs: ['--locked'],
      }),
    ).toBe(true)
    expect(
      await getManagedInstaller('deno').uninstall('jsr:@scope/tool', undefined, {
        binaryName: 'tool-bin',
      }),
    ).toBe(true)
    expect(cargoUpdate).toHaveBeenCalledWith('some-crate', ['--locked'], expect.any(Object))
    expect(denoUninstall).toHaveBeenCalledWith('tool-bin', expect.any(Object))
  })

  it('keeps uv and mise presence/version probes as direct compatibility projections', async () => {
    const uvPresence = vi.spyOn(uvPm, 'probePackagePresence').mockResolvedValue('present')
    const miseVersion = vi.spyOn(misePm, 'getInstalledVersion').mockResolvedValue('0.42.0')

    expect(await getManagedInstaller('uv').probePackagePresence?.('example-tool')).toBe('present')
    expect(await getManagedInstaller('mise').getInstalledVersion?.('npm:@openai/codex')).toBe('0.42.0')
    expect(uvPresence).toHaveBeenCalledWith('example-tool')
    expect(miseVersion).toHaveBeenCalledWith('npm:@openai/codex')
  })
})
