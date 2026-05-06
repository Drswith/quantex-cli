import type { CommandResult } from '../output/types'
import type { CommandWarning } from '../output/types'
import type { SelfUpdateChannel } from '../self'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { getSelfUpgradeRecoveryHintForInspection, inspectSelf, upgradeSelf } from '../self'
import { pc } from '../utils/color'
import { isDryRunEnabled, printError, printInfo, printWarn } from '../utils/user-output'
import { compareVersions, isVersionNewer } from '../utils/version'

interface UpgradeCommandData {
  canAutoUpdate: boolean
  channel: SelfUpdateChannel
  currentVersion: string
  installSource: string
  latestVersion?: string
  recoveryHint?: string
  status: 'check-unavailable' | 'manual-required' | 'up-to-date' | 'update-available' | 'updated'
}

export async function upgradeCommand(
  options: { channel?: SelfUpdateChannel; check?: boolean } = {},
): Promise<CommandResult<UpgradeCommandData>> {
  const inspection = await inspectSelf({ updateChannel: options.channel })
  const dryRun = isDryRunEnabled()
  const registryWarnings = getManagedRegistryWarnings(inspection)
  const staleLatestWarning = getStaleLatestWarning(inspection)
  const updateAvailable = inspection.latestVersion
    ? isVersionNewer(inspection.latestVersion, inspection.currentVersion)
    : false

  if (!updateAvailable) {
    return emitCommandResult(
      createSuccessResult<UpgradeCommandData>({
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
        warnings: [...registryWarnings, ...(staleLatestWarning ? [staleLatestWarning] : [])],
      }),
      renderUpgradeHuman,
    )
  }

  if (options.check || dryRun) {
    if (inspection.latestVersion) {
      return emitCommandResult(
        createSuccessResult<UpgradeCommandData>({
          action: 'upgrade',
          data: {
            canAutoUpdate: inspection.canAutoUpdate,
            channel: inspection.updateChannel,
            currentVersion: inspection.currentVersion,
            installSource: inspection.installSource,
            latestVersion: inspection.latestVersion,
            status: 'update-available',
          },
          exitCode: options.check ? 1 : undefined,
          target: {
            kind: 'self',
            name: 'quantex',
          },
          warnings: [
            ...registryWarnings,
            ...(staleLatestWarning ? [staleLatestWarning] : []),
            ...(dryRun
              ? [
                  {
                    code: 'DRY_RUN',
                    message: 'Dry run: would upgrade Quantex CLI.',
                  },
                ]
              : []),
          ],
        }),
        renderUpgradeHuman,
      )
    }

    return emitCommandResult(
      createErrorResult<UpgradeCommandData>({
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
        warnings: [...registryWarnings, ...(staleLatestWarning ? [staleLatestWarning] : [])],
      }),
      renderUpgradeHuman,
    )
  }

  if (!inspection.canAutoUpdate) {
    const manualCommand = getSelfUpgradeRecoveryHintForInspection(inspection)
    return emitCommandResult(
      createErrorResult<UpgradeCommandData>({
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
        warnings: [...registryWarnings, ...(staleLatestWarning ? [staleLatestWarning] : [])],
      }),
      renderUpgradeHuman,
    )
  }

  const result = await upgradeSelf(inspection)
  if (result.success) {
    return emitCommandResult(
      createSuccessResult<UpgradeCommandData>({
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
        warnings: [...registryWarnings, ...(staleLatestWarning ? [staleLatestWarning] : [])],
      }),
      renderUpgradeHuman,
    )
  }

  const manualCommand = getSelfUpgradeRecoveryHintForInspection(inspection, result)

  return emitCommandResult(
    createErrorResult<UpgradeCommandData>({
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
      warnings: [
        ...registryWarnings,
        ...(manualCommand
          ? [
              {
                code: 'MANUAL_RECOVERY',
                message: `Manual recovery: ${manualCommand}`,
              },
            ]
          : []),
      ],
    }),
    renderUpgradeHuman,
  )
}

function renderUpgradeHuman(result: {
  data?: UpgradeCommandData
  error: { code?: string; message: string } | null
  warnings: CommandWarning[]
}): void {
  if (!result.data) {
    if (result.error) printError(pc.red(result.error.message))
    return
  }

  if (result.data.status === 'up-to-date') {
    printInfo(pc.green(`Quantex CLI is already up to date (${result.data.currentVersion}).`))
    renderInformationalWarnings(result.warnings)
    return
  }

  if (result.data.status === 'update-available') {
    const prefix = result.warnings.some(warning => warning.message.includes('Dry run')) ? 'Dry run: ' : ''
    printWarn(
      pc.yellow(
        `${prefix}Update available for Quantex CLI: ${result.data.currentVersion} -> ${result.data.latestVersion} (${result.data.channel}).`,
      ),
    )
    renderInformationalWarnings(result.warnings)
    return
  }

  if (result.data.status === 'check-unavailable') {
    if (result.error) printWarn(pc.yellow(result.error.message))
    renderInformationalWarnings(result.warnings)
    return
  }

  if (result.data.status === 'manual-required' && result.error?.code === 'MANUAL_ACTION_REQUIRED') {
    printWarn(pc.yellow(result.error.message))
    if (result.data.recoveryHint) printWarn(pc.cyan(`Next step: ${result.data.recoveryHint}`))
    return
  }

  const versionHint = result.data.latestVersion
    ? ` (${result.data.currentVersion} -> ${result.data.latestVersion})`
    : ` (${result.data.currentVersion})`

  printInfo(pc.cyan(`Upgrading Quantex CLI...${versionHint}`))

  if (!result.error) {
    printInfo(pc.green('Quantex CLI upgraded successfully.'))
    renderInformationalWarnings(result.warnings)
    return
  }

  printError(pc.red('Failed to upgrade Quantex CLI.'))
  printWarn(pc.yellow(`Reason: ${result.error.message}`))
  for (const warning of result.warnings) printWarn(pc.cyan(warning.message.replace(/^Manual recovery:/, 'Next step:')))
}

function getManagedRegistryWarnings(inspection: Awaited<ReturnType<typeof inspectSelf>>): CommandWarning[] {
  if (!inspection.latestVersion || !inspection.upstreamLatestVersion) return []
  if (inspection.latestVersion === inspection.upstreamLatestVersion) return []
  if (inspection.installSource !== 'bun' && inspection.installSource !== 'npm') return []

  return [
    {
      code: 'MIRROR_LAG',
      details: {
        installableLatestVersion: inspection.latestVersion,
        upstreamLatestVersion: inspection.upstreamLatestVersion,
      },
      message: `The selected registry currently installs ${inspection.latestVersion}, while upstream npm has ${inspection.upstreamLatestVersion}. Retry later or set selfUpdateRegistry / QTX_SELF_UPDATE_REGISTRY to another registry if you need the upstream release now.`,
    },
  ]
}

function renderInformationalWarnings(warnings: CommandWarning[]): void {
  for (const warning of warnings) {
    if (warning.code === 'DRY_RUN' || warning.code === 'MANUAL_RECOVERY') continue
    printWarn(pc.yellow(warning.message))
  }
}

function getStaleLatestWarning(inspection: Awaited<ReturnType<typeof inspectSelf>>): CommandWarning | undefined {
  if (!inspection.latestVersion) return undefined

  const comparison = compareVersions(inspection.latestVersion, inspection.currentVersion)
  if (comparison === undefined || comparison >= 0) return undefined

  return {
    code: 'STALE_LATEST_VERSION',
    details: {
      currentVersion: inspection.currentVersion,
      latestVersion: inspection.latestVersion,
    },
    message: `The resolved latest version ${inspection.latestVersion} is older than the installed Quantex CLI ${inspection.currentVersion}. Quantex will not downgrade; retry with --refresh or --no-cache if you need a fresh check.`,
  }
}
