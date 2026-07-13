import type { SystemPackageAdapterDependencies } from './system-package'
import * as pipPm from '../../package-manager/pip'
import * as detectUtils from '../../utils/detect'
import { createSystemPackageAdapter } from './system-package'

const defaultDependencies: SystemPackageAdapterDependencies = {
  contextualObservation: true,
  install: target => pipPm.install(target.id),
  isAvailable: context => detectUtils.isPipAvailable(context),
  probePackagePresence: async () => 'unknown',
  uninstall: target => pipPm.uninstall(target.id),
  update: target => pipPm.update(target.id),
  updateMany: targets => pipPm.updateMany(targets.map(target => ({ packageName: target.id }))),
}

export function createPipProviderAdapter(dependencies: SystemPackageAdapterDependencies = defaultDependencies) {
  return createSystemPackageAdapter(
    {
      commands: {
        install: target => ['pip', 'install', target.id],
        uninstall: target => ['pip', 'uninstall', '-y', target.id],
        update: target => ['pip', 'install', '--upgrade', target.id],
        updateMany: targets => ['pip', 'install', '--upgrade', ...targets.map(target => target.id)],
      },
      displayName: 'pip',
      executable: 'pip',
      id: 'pip',
    },
    dependencies,
  )
}

export const pipProviderAdapter = createPipProviderAdapter()
