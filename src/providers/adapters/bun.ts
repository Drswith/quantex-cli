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
  contextualMutation: true,
  contextualPackageObservation: true,
  getInstalledVersion: (packageName, context) => bunPm.getInstalledVersion(packageName, context),
  install: (packageName, distTag, registry, context) => bunPm.installOutcome(packageName, distTag, registry, context),
  isAvailable: context => detectUtils.isBunAvailable(context),
  probePackagePresence: (packageName, context) => bunPm.probePackagePresence(packageName, undefined, context),
  resolveLatestVersion: (packageName, distTag, registry) =>
    versionUtils.getLatestVersion(packageName, distTag, { registry }),
  uninstall: (packageName, context) => bunPm.uninstallOutcome(packageName, context),
  update: (packageName, strategy, distTag, registry, context) =>
    bunPm.updateOutcome(packageName, strategy, distTag, registry, context),
  updateMany: (packageNames, strategy, context) => bunPm.updateManyOutcome(packageNames, strategy, context),
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
