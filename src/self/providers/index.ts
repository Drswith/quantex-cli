import type { SelfInspection, SelfInstallSource, SelfUpdateChannel } from '../types'
import type { SelfUpgradeProvider } from './types'
import { binarySelfUpgradeProvider } from './binary'
import { bunSelfUpgradeProvider } from './bun'
import { npmSelfUpgradeProvider } from './npm'
import { sourceSelfUpgradeProvider } from './source'

const selfUpgradeProviders: SelfUpgradeProvider[] = [
  bunSelfUpgradeProvider,
  npmSelfUpgradeProvider,
  binarySelfUpgradeProvider,
  sourceSelfUpgradeProvider,
]

export function getSelfUpgradeProvider(inspection: SelfInspection): SelfUpgradeProvider {
  return selfUpgradeProviders.find(provider => provider.canHandle(inspection)) ?? sourceSelfUpgradeProvider
}

export function getSelfUpgradeProviderForInstallSource(
  installSource: SelfInstallSource,
  executablePath: string,
  updateChannel: SelfUpdateChannel = 'stable',
): SelfUpgradeProvider {
  return getSelfUpgradeProvider({
    canAutoUpdate: installSource === 'binary' || installSource === 'bun' || installSource === 'npm',
    currentVersion: '',
    executablePath,
    installSource,
    packageRoot: '',
    updateChannel,
  })
}

export { selfUpgradeProviders }
export type { SelfUpgradeProvider } from './types'
