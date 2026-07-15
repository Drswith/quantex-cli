import type { SelfInspection, SelfUpdateResult, SelfUpgradePlan } from '../types'
import type { SelfUpgradeProvider, SelfUpgradeProviderExecutionContext } from './types'
import { BUILD_PACKAGE_NAME } from '../../generated/build-meta'
import * as npmPm from '../../package-manager/npm'
import { runManagedSelfInstall } from './managed-process'

export const npmSelfUpgradeProvider: SelfUpgradeProvider = {
  source: 'npm',
  canHandle: context => getInstallSource(context) === 'npm',
  getRecoveryHint: inspection =>
    `npm install -g ${BUILD_PACKAGE_NAME}@${inspection.updateChannel === 'beta' ? 'beta' : 'latest'}`,
  async upgrade(plan: SelfUpgradePlan, context?: SelfUpgradeProviderExecutionContext): Promise<SelfUpdateResult> {
    const tag = plan.target.packageTag ?? (plan.facts.updateChannel === 'beta' ? 'beta' : 'latest')
    const success = context?.process
      ? await runManagedSelfInstall(
          [
            'npm',
            'install',
            '-g',
            `${BUILD_PACKAGE_NAME}@${tag}`,
            ...(plan.target.managedRegistry ? ['--registry', plan.target.managedRegistry] : []),
          ],
          context,
        )
      : await npmPm.install(BUILD_PACKAGE_NAME, tag, plan.target.managedRegistry)
    return {
      error: success
        ? undefined
        : {
            kind: 'unknown',
            message: `Failed to update ${BUILD_PACKAGE_NAME} through npm.`,
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
