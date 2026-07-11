import type { ProviderTarget } from '../types'
import type { SystemPackageAdapterDependencies } from './system-package'
import * as cargoPm from '../../package-manager/cargo'
import * as detectUtils from '../../utils/detect'
import { createSystemPackageAdapter } from './system-package'

const defaultDependencies: SystemPackageAdapterDependencies = {
  install: target => cargoPm.install(target.id, target.arguments ? [...target.arguments] : undefined),
  isAvailable: () => detectUtils.isCargoAvailable(),
  probePackagePresence: async () => 'unknown',
  uninstall: target => cargoPm.uninstall(target.id),
  update: target => cargoPm.update(target.id, target.arguments ? [...target.arguments] : undefined),
  updateMany: targets =>
    cargoPm.updateMany(
      targets.map(target => ({
        ...(target.arguments ? { packageInstallArgs: [...target.arguments] } : {}),
        packageName: target.id,
      })),
    ),
}

function installCommand(target: ProviderTarget, force = false): readonly string[] {
  return ['cargo', 'install', target.id, ...(force ? ['--force'] : []), ...(target.arguments ?? [])]
}

export function createCargoProviderAdapter(dependencies: SystemPackageAdapterDependencies = defaultDependencies) {
  return createSystemPackageAdapter(
    {
      commands: {
        install: target => installCommand(target),
        uninstall: target => ['cargo', 'uninstall', target.id],
        update: target => installCommand(target, true),
        updateMany: targets => [
          'cargo',
          'install',
          ...targets.flatMap(target => [target.id, '--force', ...(target.arguments ?? [])]),
        ],
      },
      displayName: 'Cargo',
      executable: 'cargo',
      id: 'cargo',
    },
    dependencies,
  )
}

export const cargoProviderAdapter = createCargoProviderAdapter()
