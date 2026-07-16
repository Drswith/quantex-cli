import type { RegistryPackageUpdateStrategy } from '../types'
import type { RegistryPackageAdapterDependencies, RegistryPackageCommandBuilders } from './registry-package'
import * as npmPm from '../../package-manager/npm'
import * as detectUtils from '../../utils/detect'
import * as versionUtils from '../../utils/version'
import { createRegistryPackageAdapter } from './registry-package'

export interface NpmProviderDependencies extends RegistryPackageAdapterDependencies {}

const commands: RegistryPackageCommandBuilders = {
  install: (target, options) => [
    'npm',
    'install',
    '-g',
    options.distTagExplicit ? `${target.id}@${options.distTag}` : target.id,
    ...(options.registry ? ['--registry', options.registry] : []),
  ],
  uninstall: target => ['npm', 'uninstall', '-g', target.id],
  update: (target, options) =>
    options.updateStrategy === 'latest-major'
      ? [
          'npm',
          'install',
          '-g',
          `${target.id}@${options.distTag}`,
          ...(options.registry ? ['--registry', options.registry] : []),
        ]
      : ['npm', 'update', '-g', target.id, ...(options.registry ? ['--registry', options.registry] : [])],
  updateMany: (targets, options) =>
    options.updateStrategy === 'latest-major'
      ? ['npm', 'install', '-g', ...targets.map(target => `${target.id}@latest`)]
      : ['npm', 'update', '-g', ...targets.map(target => target.id)],
}

const defaultDependencies: NpmProviderDependencies = {
  contextualMutation: true,
  contextualPackageObservation: true,
  getInstalledVersion: (packageName, context) => npmPm.getInstalledVersion(packageName, context),
  install: (packageName, distTag, registry, context) => npmPm.installOutcome(packageName, distTag, registry, context),
  isAvailable: context => detectUtils.isNpmAvailable(context),
  probePackagePresence: (packageName, context) => npmPm.probePackagePresence(packageName, context),
  resolveLatestVersion: (packageName, distTag, registry) =>
    versionUtils.getLatestVersion(packageName, distTag, { registry }),
  uninstall: (packageName, context) => npmPm.uninstallOutcome(packageName, context),
  update: (packageName, strategy, distTag, registry, context) =>
    npmPm.updateOutcome(packageName, strategy, distTag, registry, context),
  updateMany: (packageNames, strategy, context) => npmPm.updateManyOutcome(packageNames, strategy, context),
}

export function createNpmProviderAdapter(dependencies: NpmProviderDependencies = defaultDependencies) {
  return createRegistryPackageAdapter(
    {
      commands,
      displayName: 'npm',
      executable: 'npm',
      id: 'npm',
    },
    dependencies,
  )
}

export const npmProviderAdapter = createNpmProviderAdapter()

export type { RegistryPackageUpdateStrategy }
