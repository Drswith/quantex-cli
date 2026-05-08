import type { SelfUpdateResult, SelfUpgradePlan } from '../types'
import type { SelfUpgradeProvider } from './types'

export const sourceSelfUpgradeProvider: SelfUpgradeProvider = {
  source: 'source',
  canHandle: context => {
    const installSource = 'facts' in context ? context.facts.installSource : context.installSource
    return installSource === 'source' || installSource === 'unknown'
  },
  getRecoveryHint: () => undefined,
  async upgrade(plan: SelfUpgradePlan): Promise<SelfUpdateResult> {
    return {
      error: {
        kind: 'unsupported',
        message: `Install source "${plan.facts.installSource}" does not support auto-update.`,
      },
      installSource: plan.facts.installSource,
      success: false,
    }
  },
}
