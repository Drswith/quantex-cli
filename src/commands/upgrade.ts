import pc from 'picocolors'
import { getManualSelfUpgradeCommand, inspectSelf, upgradeSelf } from '../self'

export async function upgradeCommand(): Promise<void> {
  const inspection = await inspectSelf()

  if (inspection.latestVersion && inspection.latestVersion === inspection.currentVersion) {
    console.log(pc.green(`Quantex CLI is already up to date (${inspection.currentVersion}).`))
    return
  }

  if (!inspection.canAutoUpdate) {
    console.log(pc.yellow(`Quantex CLI cannot auto-update from the current install source: ${inspection.installSource}.`))
    const manualCommand = getManualSelfUpgradeCommand(inspection.installSource, inspection.executablePath)
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
    const manualCommand = getManualSelfUpgradeCommand(inspection.installSource, inspection.executablePath)
    if (manualCommand)
      console.log(pc.cyan(`Manual recovery: ${manualCommand}`))
  }
}
