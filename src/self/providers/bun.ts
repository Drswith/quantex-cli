import type { SelfInspection, SelfUpdateResult, SelfUpgradePlan } from '../types'
import type { SelfUpgradeProvider, SelfUpgradeProviderExecutionContext } from './types'
import { BUILD_PACKAGE_NAME } from '../../generated/build-meta'
import * as bunPm from '../../package-manager/bun'
import { runBunManagedSelfInstall } from './managed-process'

export const bunSelfUpgradeProvider: SelfUpgradeProvider = {
  source: 'bun',
  canHandle: context => getInstallSource(context) === 'bun',
  getRecoveryHint: inspection =>
    `bun add -g ${BUILD_PACKAGE_NAME}@${inspection.updateChannel === 'beta' ? 'beta' : 'latest'}`,
  async upgrade(plan: SelfUpgradePlan, context?: SelfUpgradeProviderExecutionContext): Promise<SelfUpdateResult> {
    const tag = plan.target.packageTag ?? (plan.facts.updateChannel === 'beta' ? 'beta' : 'latest')
    const success = context?.process
      ? await runBunManagedSelfInstall(
          [
            'bun',
            'add',
            '-g',
            ...(plan.target.managedRegistry ? ['--registry', plan.target.managedRegistry] : []),
            `${BUILD_PACKAGE_NAME}@${tag}`,
          ],
          BUILD_PACKAGE_NAME,
          context,
        )
      : await bunPm.install(BUILD_PACKAGE_NAME, tag, plan.target.managedRegistry)
    return {
      error: success
        ? undefined
        : {
            kind: 'unknown',
            message: `Failed to update ${BUILD_PACKAGE_NAME} through Bun.`,
          },
      installSource: plan.facts.installSource,
      newVersion: success ? plan.target.targetVersion : undefined,
      success,
    }
  },
}

function getInstallSource(context: SelfInspection | SelfUpgradePlan): string {
  return 'facts' in context ? context.facts.installSource : context.installSource
}
