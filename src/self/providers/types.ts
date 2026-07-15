import type { NetworkPort, ProcessPort, ProcessStdio } from '../../runtime'
import type { SelfInspection, SelfInstallSource, SelfUpdateResult, SelfUpgradePlan } from '../types'

export interface SelfUpgradeProviderExecutionContext {
  readonly process?: ProcessPort
  readonly network?: NetworkPort
  readonly signal: AbortSignal
  readonly stdio?: readonly [ProcessStdio, ProcessStdio, ProcessStdio]
  readonly timeoutMs?: number
}

export interface SelfUpgradeProvider {
  canHandle: (context: SelfInspection | SelfUpgradePlan) => boolean
  getRecoveryHint: (inspection: SelfInspection, result?: SelfUpdateResult) => string | undefined
  upgrade: (plan: SelfUpgradePlan, context?: SelfUpgradeProviderExecutionContext) => Promise<SelfUpdateResult>
  source: SelfInstallSource
}
