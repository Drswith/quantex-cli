import type { ProviderTarget } from '../types'
import type { SystemPackageAdapterDependencies } from './system-package'
import * as brewPm from '../../package-manager/brew'
import * as detectUtils from '../../utils/detect'
import { createSystemPackageAdapter } from './system-package'

const defaultDependencies: SystemPackageAdapterDependencies = {
  contextualObservation: true,
  install: target => brewPm.install(target.id, target.kind === 'cask' ? 'cask' : 'package'),
  isAvailable: context => detectUtils.isBrewAvailable(context),
  probePackagePresence: async () => 'unknown',
  uninstall: target => brewPm.uninstall(target.id, target.kind === 'cask' ? 'cask' : 'package'),
  update: target => brewPm.update(target.id, target.kind === 'cask' ? 'cask' : 'package'),
  updateMany: targets =>
    brewPm.updateMany(
      targets.map(target => ({
        packageName: target.id,
        packageTargetKind: target.kind === 'cask' ? 'cask' : 'package',
      })),
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
