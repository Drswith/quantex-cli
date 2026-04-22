import type { CommandResult } from '../output/types'
import type { SelfUpdateChannel } from '../self'
import pc from 'picocolors'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { getSelfUpgradeRecoveryHintForInspection, inspectSelf, upgradeSelf } from '../self'

interface UpgradeCommandData {
  canAutoUpdate: boolean
  channel: SelfUpdateChannel
  currentVersion: string
  installSource: string
  latestVersion?: string
  recoveryHint?: string
  status: 'check-unavailable' | 'manual-required' | 'up-to-date' | 'update-available' | 'updated'
}

export async function upgradeCommand(options: { channel?: SelfUpdateChannel, check?: boolean } = {}): Promise<CommandResult<UpgradeCommandData>> {
  const inspection = await inspectSelf({ updateChannel: options.channel })

  if (inspection.latestVersion && inspection.latestVersion === inspection.currentVersion) {
    return emitCommandResult(createSuccessResult<UpgradeCommandData>({
      action: 'upgrade',
      data: {
        canAutoUpdate: inspection.canAutoUpdate,
        channel: inspection.updateChannel,
        currentVersion: inspection.currentVersion,
        installSource: inspection.installSource,
        latestVersion: inspection.latestVersion,
        status: 'up-to-date',
      },
      target: {
        kind: 'self',
        name: 'quantex',
      },
    }), renderUpgradeHuman)
  }

  if (options.check) {
    if (inspection.latestVersion) {
      return emitCommandResult(createSuccessResult<UpgradeCommandData>({
        action: 'upgrade',
        data: {
          canAutoUpdate: inspection.canAutoUpdate,
          channel: inspection.updateChannel,
          currentVersion: inspection.currentVersion,
          installSource: inspection.installSource,
          latestVersion: inspection.latestVersion,
          status: 'update-available',
        },
        exitCode: 1,
        target: {
          kind: 'self',
          name: 'quantex',
        },
      }), renderUpgradeHuman)
    }

    return emitCommandResult(createErrorResult<UpgradeCommandData>({
      action: 'upgrade',
      data: {
        canAutoUpdate: inspection.canAutoUpdate,
        channel: inspection.updateChannel,
        currentVersion: inspection.currentVersion,
        installSource: inspection.installSource,
        status: 'check-unavailable',
      },
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to determine the latest Quantex CLI version.',
      },
      target: {
        kind: 'self',
        name: 'quantex',
      },
    }), renderUpgradeHuman)
  }

  if (!inspection.canAutoUpdate) {
    const manualCommand = getSelfUpgradeRecoveryHintForInspection(inspection)
    return emitCommandResult(createErrorResult<UpgradeCommandData>({
      action: 'upgrade',
      data: {
        canAutoUpdate: inspection.canAutoUpdate,
        channel: inspection.updateChannel,
        currentVersion: inspection.currentVersion,
        installSource: inspection.installSource,
        latestVersion: inspection.latestVersion,
        recoveryHint: manualCommand,
        status: 'manual-required',
      },
      error: {
        code: 'MANUAL_ACTION_REQUIRED',
        message: `Quantex CLI cannot auto-update from the current install source: ${inspection.installSource}.`,
      },
      target: {
        kind: 'self',
        name: 'quantex',
      },
    }), renderUpgradeHuman)
  }

  const result = await upgradeSelf(inspection)
  if (result.success) {
    return emitCommandResult(createSuccessResult<UpgradeCommandData>({
      action: 'upgrade',
      data: {
        canAutoUpdate: inspection.canAutoUpdate,
        channel: inspection.updateChannel,
        currentVersion: inspection.currentVersion,
        installSource: inspection.installSource,
        latestVersion: inspection.latestVersion,
        status: 'updated',
      },
      target: {
        kind: 'self',
        name: 'quantex',
      },
    }), renderUpgradeHuman)
  }

  const manualCommand = getSelfUpgradeRecoveryHintForInspection(inspection, result)

  return emitCommandResult(createErrorResult<UpgradeCommandData>({
    action: 'upgrade',
    data: {
      canAutoUpdate: inspection.canAutoUpdate,
      channel: inspection.updateChannel,
      currentVersion: inspection.currentVersion,
      installSource: inspection.installSource,
      latestVersion: inspection.latestVersion,
      recoveryHint: manualCommand,
      status: 'manual-required',
    },
    error: {
      code: 'UPGRADE_FAILED',
      details: result.error?.kind
        ? {
            kind: result.error.kind,
          }
        : undefined,
      message: result.error?.message ?? 'Failed to upgrade Quantex CLI.',
    },
    target: {
      kind: 'self',
      name: 'quantex',
    },
    warnings: manualCommand
      ? [{
          code: 'MANUAL_RECOVERY',
          message: `Manual recovery: ${manualCommand}`,
        }]
      : [],
  }), renderUpgradeHuman)
}

function renderUpgradeHuman(result: { data?: UpgradeCommandData, error: { code?: string, message: string } | null, warnings: Array<{ message: string }> }): void {
  if (!result.data) {
    if (result.error)
      console.log(pc.red(result.error.message))
    return
  }

  if (result.data.status === 'up-to-date') {
    console.log(pc.green(`Quantex CLI is already up to date (${result.data.currentVersion}).`))
    return
  }

  if (result.data.status === 'update-available') {
    console.log(pc.yellow(`Update available for Quantex CLI: ${result.data.currentVersion} -> ${result.data.latestVersion} (${result.data.channel}).`))
    return
  }

  if (result.data.status === 'check-unavailable') {
    if (result.error)
      console.log(pc.yellow(result.error.message))
    return
  }

  if (result.data.status === 'manual-required' && result.error?.code === 'MANUAL_ACTION_REQUIRED') {
    console.log(pc.yellow(result.error.message))
    if (result.data.recoveryHint)
      console.log(pc.cyan(`Manual upgrade: ${result.data.recoveryHint}`))
    return
  }

  const versionHint = result.data.latestVersion
    ? ` (${result.data.currentVersion} -> ${result.data.latestVersion})`
    : ` (${result.data.currentVersion})`

  console.log(pc.cyan(`Upgrading Quantex CLI...${versionHint}`))

  if (!result.error) {
    console.log(pc.green('Quantex CLI upgraded successfully.'))
    return
  }

  console.log(pc.red('Failed to upgrade Quantex CLI.'))
  console.log(pc.yellow(`Reason: ${result.error.message}`))
  for (const warning of result.warnings)
    console.log(pc.cyan(warning.message))
}
