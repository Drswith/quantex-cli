import pc from 'picocolors'
import { getSelfUpgradeRecoveryHintForInspection, inspectSelf, upgradeSelf } from '../self'

export async function upgradeCommand(): Promise<void> {
  const inspection = await inspectSelf()

  if (inspection.latestVersion && inspection.latestVersion === inspection.currentVersion) {
    console.log(pc.green(`Quantex CLI is already up to date (${inspection.currentVersion}).`))
    return
  }

  if (!inspection.canAutoUpdate) {
    console.log(pc.yellow(`Quantex CLI cannot auto-update from the current install source: ${inspection.installSource}.`))
    const manualCommand = getSelfUpgradeRecoveryHintForInspection(inspection)
    if (manualCommand)
      console.log(pc.cyan(`Manual upgrade: ${manualCommand}`))
    return
  }

  const versionHint = inspection.latestVersion
    ? ` (${inspection.currentVersion} -> ${inspection.latestVersion})`
    : ` (${inspection.currentVersion})`

  console.log(pc.cyan(`Upgrading Quantex CLI...${versionHint}`))

  const result = await upgradeSelf(inspection)
  if (result.success) {
    console.log(pc.green('Quantex CLI upgraded successfully.'))
  }
  else {
    console.log(pc.red('Failed to upgrade Quantex CLI.'))
    if (result.error?.message)
      console.log(pc.yellow(`Reason: ${result.error.message}`))
    const manualCommand = getSelfUpgradeRecoveryHintForInspection(inspection, result)
    if (manualCommand)
      console.log(pc.cyan(`Manual recovery: ${manualCommand}`))
  }
}
