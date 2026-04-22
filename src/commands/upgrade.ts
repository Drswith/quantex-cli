import type { SelfUpdateChannel } from '../self'
import pc from 'picocolors'
import { getSelfUpgradeRecoveryHintForInspection, inspectSelf, upgradeSelf } from '../self'

export async function upgradeCommand(options: { channel?: SelfUpdateChannel, check?: boolean } = {}): Promise<number> {
  const inspection = await inspectSelf({ updateChannel: options.channel })

  if (inspection.latestVersion && inspection.latestVersion === inspection.currentVersion) {
    console.log(pc.green(`Quantex CLI is already up to date (${inspection.currentVersion}).`))
    return 0
  }

  if (options.check) {
    if (inspection.latestVersion) {
      console.log(pc.yellow(`Update available for Quantex CLI: ${inspection.currentVersion} -> ${inspection.latestVersion} (${inspection.updateChannel}).`))
      return 1
    }

    console.log(pc.yellow('Unable to determine the latest Quantex CLI version.'))
    return 2
  }

  if (!inspection.canAutoUpdate) {
    console.log(pc.yellow(`Quantex CLI cannot auto-update from the current install source: ${inspection.installSource}.`))
    const manualCommand = getSelfUpgradeRecoveryHintForInspection(inspection)
    if (manualCommand)
      console.log(pc.cyan(`Manual upgrade: ${manualCommand}`))
    return 2
  }

  const versionHint = inspection.latestVersion
    ? ` (${inspection.currentVersion} -> ${inspection.latestVersion})`
    : ` (${inspection.currentVersion})`

  console.log(pc.cyan(`Upgrading Quantex CLI...${versionHint}`))

  const result = await upgradeSelf(inspection)
  if (result.success) {
    console.log(pc.green('Quantex CLI upgraded successfully.'))
    return 0
  }
  else {
    console.log(pc.red('Failed to upgrade Quantex CLI.'))
    if (result.error?.message)
      console.log(pc.yellow(`Reason: ${result.error.message}`))
    const manualCommand = getSelfUpgradeRecoveryHintForInspection(inspection, result)
    if (manualCommand)
      console.log(pc.cyan(`Manual recovery: ${manualCommand}`))
    return 2
  }
}
