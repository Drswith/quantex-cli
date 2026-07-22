import { describe, expect, it } from 'vitest'
import { getInstallerCapabilities, getManagedInstallTypes } from '../../src/package-manager/capabilities'
import { firstPartyProviderRegistry } from '../../src/providers/first-party'

describe('first-party provider registry projections', () => {
  it('contains every closed provider in maintained update order', () => {
    expect(firstPartyProviderRegistry.list().map(adapter => adapter.id)).toEqual([
      'bun',
      'npm',
      'brew',
      'cargo',
      'deno',
      'mise',
      'pip',
      'uv',
      'winget',
      'script',
      'binary',
    ])
    expect(getManagedInstallTypes()).toEqual(['bun', 'npm', 'brew', 'cargo', 'deno', 'mise', 'pip', 'uv', 'winget'])
  })

  it('derives maintained capability results from implemented adapter operations', () => {
    expect(getInstallerCapabilities('npm')).toEqual({
      canInstall: true,
      canLookupLatestVersion: true,
      canUninstall: true,
      canUpdate: true,
      lifecycle: 'managed',
    })
    expect(getInstallerCapabilities('brew')).toEqual({
      canInstall: true,
      canLookupLatestVersion: false,
      canUninstall: true,
      canUpdate: true,
      lifecycle: 'managed',
    })
    expect(getInstallerCapabilities('script')).toEqual({
      canInstall: true,
      canLookupLatestVersion: false,
      canUninstall: false,
      canUpdate: false,
      lifecycle: 'unmanaged',
    })
    expect(getInstallerCapabilities('binary')).toEqual(getInstallerCapabilities('script'))
  })

  it('keeps registry operations and compatibility projections in lockstep', () => {
    const managedProviderIds = firstPartyProviderRegistry
      .list()
      .filter(adapter => {
        const operations = firstPartyProviderRegistry.getCapabilities(adapter.id)
        return operations.includes('update') && operations.includes('uninstall')
      })
      .map(adapter => adapter.id)

    expect(getManagedInstallTypes()).toEqual(managedProviderIds)

    for (const adapter of firstPartyProviderRegistry.list()) {
      const operations = firstPartyProviderRegistry.getCapabilities(adapter.id)
      const projected = getInstallerCapabilities(adapter.id)

      expect(projected.canInstall).toBe(operations.includes('install'))
      expect(projected.canLookupLatestVersion).toBe(operations.includes('resolve-latest-version'))
      expect(projected.canUninstall).toBe(operations.includes('uninstall'))
      expect(projected.canUpdate).toBe(operations.includes('update'))
    }
  })
})
