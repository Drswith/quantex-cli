import type { ProviderTarget } from '../types'
import type { SystemPackageAdapterDependencies } from './system-package'
import * as misePm from '../../package-manager/mise'
import * as detectUtils from '../../utils/detect'
import { createSystemPackageAdapter } from './system-package'

const defaultDependencies: SystemPackageAdapterDependencies = {
  contextualObservation: true,
  getInstalledVersion: (target, context) => misePm.getInstalledVersion(target.id, context),
  install: target => misePm.install(target.id),
  isAvailable: context => detectUtils.isMiseAvailable(context),
  probePackagePresence: (target, context) => misePm.probePackagePresence(target.id, context),
  uninstall: target => misePm.uninstall(target.id),
  update: target => misePm.update(target.id),
  updateMany: targets => misePm.updateMany(targets.map(target => ({ packageName: target.id }))),
}

function useCommand(target: ProviderTarget, force = false): readonly string[] {
  return ['mise', 'use', '--global', ...(force ? ['--force'] : []), target.id]
}

export function createMiseProviderAdapter(dependencies: SystemPackageAdapterDependencies = defaultDependencies) {
  return createSystemPackageAdapter(
    {
      commands: {
        install: target => useCommand(target),
        uninstall: target => ['mise', 'unuse', '--global', target.id],
        update: target => useCommand(target, true),
        updateMany: targets => ['mise', 'use', '--global', '--force', ...targets.map(target => target.id)],
      },
      displayName: 'mise',
      executable: 'mise',
      id: 'mise',
    },
    dependencies,
  )
}

export const miseProviderAdapter = createMiseProviderAdapter()
