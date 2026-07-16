import type { ProviderTarget } from '../types'
import type { SystemPackageAdapterDependencies } from './system-package'
import * as denoPm from '../../package-manager/deno'
import * as detectUtils from '../../utils/detect'
import { createSystemPackageAdapter } from './system-package'

const defaultDependencies: SystemPackageAdapterDependencies = {
  contextualMutation: true,
  contextualObservation: true,
  install: (target, context) =>
    denoPm.installOutcome(target.id, target.arguments ? [...target.arguments] : undefined, context),
  isAvailable: context => detectUtils.isDenoAvailable(context),
  probePackagePresence: async () => 'unknown',
  uninstall: (target, context) => denoPm.uninstallOutcome(target.binaryName ?? target.id, context),
  update: (target, context) =>
    denoPm.updateOutcome(target.id, target.arguments ? [...target.arguments] : undefined, context),
  updateMany: (targets, context) =>
    denoPm.updateManyOutcome(
      targets.map(target => ({
        ...(target.arguments ? { packageInstallArgs: [...target.arguments] } : {}),
        ...(target.binaryName ? { binaryName: target.binaryName } : {}),
        packageName: target.id,
      })),
      context,
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
