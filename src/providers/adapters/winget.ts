import type { ProviderTarget } from '../types'
import type { SystemPackageAdapterDependencies } from './system-package'
import * as wingetPm from '../../package-manager/winget'
import * as detectUtils from '../../utils/detect'
import { createSystemPackageAdapter } from './system-package'

const defaultDependencies: SystemPackageAdapterDependencies = {
  install: target => wingetPm.install(target.id),
  isAvailable: () => detectUtils.isWingetAvailable(),
  probePackagePresence: async () => 'unknown',
  uninstall: target => wingetPm.uninstall(target.id),
  update: target => wingetPm.update(target.id),
  updateMany: targets => wingetPm.updateMany(targets.map(target => ({ packageName: target.id }))),
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
