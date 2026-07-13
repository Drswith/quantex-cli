import type { ProviderTarget } from '../types'
import type { SystemPackageAdapterDependencies } from './system-package'
import * as denoPm from '../../package-manager/deno'
import * as detectUtils from '../../utils/detect'
import { createSystemPackageAdapter } from './system-package'

const defaultDependencies: SystemPackageAdapterDependencies = {
  contextualObservation: true,
  install: target => denoPm.install(target.id, target.arguments ? [...target.arguments] : undefined),
  isAvailable: context => detectUtils.isDenoAvailable(context),
  probePackagePresence: async () => 'unknown',
  uninstall: target => denoPm.uninstall(target.binaryName ?? target.id),
  update: target => denoPm.update(target.id, target.arguments ? [...target.arguments] : undefined),
  updateMany: targets =>
    denoPm.updateMany(
      targets.map(target => ({
        ...(target.arguments ? { packageInstallArgs: [...target.arguments] } : {}),
        ...(target.binaryName ? { binaryName: target.binaryName } : {}),
        packageName: target.id,
      })),
    ),
}

function installCommand(target: ProviderTarget, force = false): readonly string[] {
  return ['deno', 'install', '--global', ...(force ? ['--force'] : []), ...(target.arguments ?? []), target.id]
}

export function createDenoProviderAdapter(dependencies: SystemPackageAdapterDependencies = defaultDependencies) {
  return createSystemPackageAdapter(
    {
      commands: {
        install: target => installCommand(target),
        uninstall: target => ['deno', 'uninstall', '--global', target.binaryName ?? target.id],
        update: target => installCommand(target, true),
        updateMany: targets => [
          'deno',
          'install',
          '--global',
          '--force',
          ...targets.flatMap(target => [...(target.arguments ?? []), target.id]),
        ],
      },
      displayName: 'Deno',
      executable: 'deno',
      id: 'deno',
    },
    dependencies,
  )
}

export const denoProviderAdapter = createDenoProviderAdapter()
