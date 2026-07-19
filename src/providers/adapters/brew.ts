import type { ProviderTarget } from '../types'
import type { SystemPackageAdapterDependencies } from './system-package'
import * as brewPm from '../../package-manager/brew'
import * as detectUtils from '../../utils/detect'
import { createSystemPackageAdapter } from './system-package'

function packageTargetKind(target: ProviderTarget): 'cask' | 'package' {
  return target.kind === 'cask' ? 'cask' : 'package'
}

const defaultDependencies: SystemPackageAdapterDependencies = {
  contextualMutation: true,
  contextualObservation: true,
  getInstalledVersion: (target, context) => brewPm.getInstalledVersion(target.id, packageTargetKind(target), context),
  install: (target, context) => brewPm.installOutcome(target.id, packageTargetKind(target), context),
  isAvailable: context => detectUtils.isBrewAvailable(context),
  probePackagePresence: (target, context) => brewPm.probePackagePresence(target.id, packageTargetKind(target), context),
  uninstall: (target, context) => brewPm.uninstallOutcome(target.id, packageTargetKind(target), context),
  update: (target, context) => brewPm.updateOutcome(target.id, packageTargetKind(target), context),
  updateMany: (targets, context) =>
    brewPm.updateManyOutcome(
      targets.map(target => ({
        packageName: target.id,
        packageTargetKind: packageTargetKind(target),
      })),
      context,
    ),
}

function command(action: 'install' | 'uninstall' | 'upgrade', target: ProviderTarget): readonly string[] {
  return ['brew', action, ...(target.kind === 'cask' ? ['--cask'] : []), target.id]
}

export function createBrewProviderAdapter(dependencies: SystemPackageAdapterDependencies = defaultDependencies) {
  return createSystemPackageAdapter(
    {
      commands: {
        install: target => command('install', target),
        uninstall: target => command('uninstall', target),
        update: target => command('upgrade', target),
        updateMany: targets => ['brew', 'upgrade', ...targets.flatMap(target => command('upgrade', target).slice(2))],
      },
      displayName: 'Homebrew',
      executable: 'brew',
      id: 'brew',
    },
    dependencies,
  )
}

export const brewProviderAdapter = createBrewProviderAdapter()
