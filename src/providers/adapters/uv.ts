import type { ProviderTarget } from '../types'
import type { SystemPackageAdapterDependencies } from './system-package'
import * as uvPm from '../../package-manager/uv'
import * as detectUtils from '../../utils/detect'
import { createSystemPackageAdapter } from './system-package'

const defaultDependencies: SystemPackageAdapterDependencies = {
  contextualMutation: true,
  contextualObservation: true,
  getInstalledVersion: (target, context) => uvPm.getInstalledVersion(target.id, context),
  install: (target, context) =>
    uvPm.installOutcome(target.id, target.arguments ? [...target.arguments] : undefined, context),
  isAvailable: context => detectUtils.isUvAvailable(context),
  probePackagePresence: (target, context) => uvPm.probePackagePresence(target.id, context),
  uninstall: (target, context) => uvPm.uninstallOutcome(target.id, context),
  update: (target, context) =>
    uvPm.updateOutcome(target.id, target.arguments ? [...target.arguments] : undefined, context),
  updateMany: (targets, context) =>
    uvPm.updateManyOutcome(
      targets.map(target => ({
        ...(target.arguments ? { packageInstallArgs: [...target.arguments] } : {}),
        packageName: target.id,
      })),
      context,
    ),
}

function command(action: 'install' | 'upgrade', target: ProviderTarget): readonly string[] {
  return ['uv', 'tool', action, target.id, ...(target.arguments ?? [])]
}

export function createUvProviderAdapter(dependencies: SystemPackageAdapterDependencies = defaultDependencies) {
  return createSystemPackageAdapter(
    {
      commands: {
        install: target => command('install', target),
        uninstall: target => ['uv', 'tool', 'uninstall', target.id],
        update: target => command('upgrade', target),
        updateMany: targets => [
          'uv',
          'tool',
          'upgrade',
          ...targets.flatMap(target => [target.id, ...(target.arguments ?? [])]),
        ],
      },
      displayName: 'uv',
      executable: 'uv',
      id: 'uv',
    },
    dependencies,
  )
}

export const uvProviderAdapter = createUvProviderAdapter()
