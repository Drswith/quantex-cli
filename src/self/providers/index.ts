import type { SelfInspection } from '../types'
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

export { selfUpgradeProviders }
export type { SelfUpgradeProvider } from './types'
