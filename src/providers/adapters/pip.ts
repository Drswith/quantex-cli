import type { SystemPackageAdapterDependencies } from './system-package'
import * as pipPm from '../../package-manager/pip'
import * as detectUtils from '../../utils/detect'
import { createSystemPackageAdapter } from './system-package'

const defaultDependencies: SystemPackageAdapterDependencies = {
  contextualMutation: true,
  contextualObservation: true,
  install: (target, context) => pipPm.installOutcome(target.id, context),
  isAvailable: context => detectUtils.isPipAvailable(context),
  probePackagePresence: async () => 'unknown',
  uninstall: (target, context) => pipPm.uninstallOutcome(target.id, context),
  update: (target, context) => pipPm.updateOutcome(target.id, context),
  updateMany: (targets, context) =>
    pipPm.updateManyOutcome(
      targets.map(target => ({ packageName: target.id })),
      context,
    ),
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
