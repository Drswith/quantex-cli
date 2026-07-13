import type { ProviderTarget } from '../types'
import type { SystemPackageAdapterDependencies } from './system-package'
import * as uvPm from '../../package-manager/uv'
import * as detectUtils from '../../utils/detect'
import { createSystemPackageAdapter } from './system-package'

const defaultDependencies: SystemPackageAdapterDependencies = {
  contextualObservation: true,
  getInstalledVersion: (target, context) => uvPm.getInstalledVersion(target.id, context),
  install: target => uvPm.install(target.id, target.arguments ? [...target.arguments] : undefined),
  isAvailable: context => detectUtils.isUvAvailable(context),
  probePackagePresence: (target, context) => uvPm.probePackagePresence(target.id, context),
  uninstall: target => uvPm.uninstall(target.id),
  update: target => uvPm.update(target.id, target.arguments ? [...target.arguments] : undefined),
  updateMany: targets =>
    uvPm.updateMany(
      targets.map(target => ({
        ...(target.arguments ? { packageInstallArgs: [...target.arguments] } : {}),
        packageName: target.id,
      })),
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
