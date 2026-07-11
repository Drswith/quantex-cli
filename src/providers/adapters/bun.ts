import type { RegistryPackageUpdateStrategy } from '../types'
import type { RegistryPackageAdapterDependencies, RegistryPackageCommandBuilders } from './registry-package'
import * as bunPm from '../../package-manager/bun'
import * as detectUtils from '../../utils/detect'
import * as versionUtils from '../../utils/version'
import { createRegistryPackageAdapter } from './registry-package'

export interface BunProviderDependencies extends RegistryPackageAdapterDependencies {}

const commands: RegistryPackageCommandBuilders = {
  install: (target, options) => [
    'bun',
    'add',
    '-g',
    ...(options.registry ? ['--registry', options.registry] : []),
    options.distTagExplicit ? `${target.id}@${options.distTag}` : target.id,
  ],
  uninstall: target => ['bun', 'remove', '-g', target.id],
  update: (target, options) => [
    'bun',
    'update',
    '-g',
    ...(options.updateStrategy === 'latest-major' ? ['--latest'] : []),
    ...(options.registry ? ['--registry', options.registry] : []),
    options.distTag === 'latest' ? target.id : `${target.id}@${options.distTag}`,
  ],
  updateMany: (targets, options) => [
    'bun',
    'update',
    '-g',
    ...(options.updateStrategy === 'latest-major' ? ['--latest'] : []),
    ...targets.map(target => target.id),
  ],
}

const defaultDependencies: BunProviderDependencies = {
  getInstalledVersion: packageName => bunPm.getInstalledVersion(packageName),
  install: (packageName, distTag, registry) =>
    distTag === undefined && registry === undefined
      ? bunPm.install(packageName)
      : bunPm.install(packageName, distTag, registry),
  isAvailable: () => detectUtils.isBunAvailable(),
  probePackagePresence: packageName => bunPm.probePackagePresence(packageName),
  resolveLatestVersion: (packageName, distTag, registry) =>
    versionUtils.getLatestVersion(packageName, distTag, { registry }),
  uninstall: packageName => bunPm.uninstall(packageName),
  update: (packageName, strategy, distTag, registry) =>
    distTag === 'latest' && registry === undefined
      ? bunPm.update(packageName, strategy)
      : bunPm.update(packageName, strategy, distTag, registry),
  updateMany: (packageNames, strategy) => bunPm.updateMany(packageNames, strategy),
}

export function createBunProviderAdapter(dependencies: BunProviderDependencies = defaultDependencies) {
  return createRegistryPackageAdapter(
    {
      commands,
      displayName: 'Bun',
      executable: 'bun',
      id: 'bun',
    },
    dependencies,
  )
}

export const bunProviderAdapter = createBunProviderAdapter()

export type { RegistryPackageUpdateStrategy }
