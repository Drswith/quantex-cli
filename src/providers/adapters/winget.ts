import type { ProviderTarget } from '../types'
import type { SystemPackageAdapterDependencies } from './system-package'
import * as wingetPm from '../../package-manager/winget'
import * as detectUtils from '../../utils/detect'
import { createSystemPackageAdapter } from './system-package'

const defaultDependencies: SystemPackageAdapterDependencies = {
  contextualMutation: true,
  contextualObservation: true,
  install: (target, context) => wingetPm.installOutcome(target.id, context),
  isAvailable: context => detectUtils.isWingetAvailable(context),
  probePackagePresence: async () => 'unknown',
  uninstall: (target, context) => wingetPm.uninstallOutcome(target.id, context),
  update: (target, context) => wingetPm.updateOutcome(target.id, context),
  updateMany: (targets, context) =>
    wingetPm.updateManyOutcome(
      targets.map(target => ({ packageName: target.id })),
      context,
    ),
}

function command(action: 'install' | 'uninstall' | 'upgrade', target: ProviderTarget): readonly string[] {
  return ['winget', action, '--id', target.id, '-e']
}

export function createWingetProviderAdapter(dependencies: SystemPackageAdapterDependencies = defaultDependencies) {
  return createSystemPackageAdapter(
    {
      commands: {
        install: target => command('install', target),
        uninstall: target => command('uninstall', target),
        update: target => command('upgrade', target),
        updateMany: targets => ['winget', 'upgrade', ...targets.flatMap(target => ['--id', target.id, '-e'])],
      },
      displayName: 'winget',
      executable: 'winget',
      id: 'winget',
    },
    dependencies,
  )
}

export const wingetProviderAdapter = createWingetProviderAdapter()
