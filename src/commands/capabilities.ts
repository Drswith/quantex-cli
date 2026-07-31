import type { CommandResult } from '../output/types'
import process from 'node:process'
import { getAllAgents } from '../agents'
import { createSuccessResult, emitCommandResult } from '../output'
import { getHumanTerminalWidth, renderHumanFields, renderHumanTable, renderHumanWrapped } from '../output/human'
import { createCliOperationContext } from '../runtime/cli-operation-context'
import { inspectSelfReadOnly } from '../self'
import { getCommandCapabilitySnapshot, projectCommandCapabilitiesToV1Features } from '../services/command-capabilities'
import { observeProviderSnapshot, projectProviderSnapshotToV1Installers } from '../services/provider-observations'
import { pc } from '../utils/color'
import { getPlatform } from '../utils/detect'

interface CapabilitiesData {
  agents: string[]
  features: {
    assumeYes: boolean
    cacheBypass: boolean
    cacheRefresh: boolean
    channels: string[]
    colorModes: string[]
    dryRun: boolean
    execInstallPolicies: string[]
    idempotencyKey: boolean
    freshnessMetadata: boolean
    logLevels: string[]
    quietLogs: boolean
    selfUpgrade: boolean
    timeout: boolean
  }
  installers: {
    brew: {
      available: boolean
      reason?: string
    }
    bun: {
      available: boolean
      reason?: string
    }
    cargo: {
      available: boolean
      reason?: string
    }
    deno: {
      available: boolean
      reason?: string
    }
    mise: {
      available: boolean
      reason?: string
    }
    npm: {
      available: boolean
      reason?: string
    }
    pip: {
      available: boolean
      reason?: string
    }
    uv: {
      available: boolean
      reason?: string
    }
    winget: {
      available: boolean
      reason?: string
    }
  }
  outputModes: string[]
  platform: {
    arch: string
    os: string
  }
}

export async function capabilitiesCommand(): Promise<CommandResult<CapabilitiesData>> {
  const operation = createCliOperationContext()
  let providerSnapshot: Awaited<ReturnType<typeof observeProviderSnapshot>>
  let selfInspection: Awaited<ReturnType<typeof inspectSelfReadOnly>>
  try {
    ;[providerSnapshot, selfInspection] = await operation.run(() =>
      Promise.all([
        observeProviderSnapshot({ context: operation.context }),
        inspectSelfReadOnly({ context: operation.context }),
      ]),
    )
  } finally {
    operation.dispose()
  }
  const installers = projectProviderSnapshotToV1Installers(providerSnapshot, entry => {
    const available = entry.availability.kind === 'success'
    return {
      available,
      reason: available ? undefined : getUnavailableReason(entry.id),
    }
  })
  const features = projectCommandCapabilitiesToV1Features(getCommandCapabilitySnapshot(), {
    canAutoUpdateSelf: selfInspection.canAutoUpdate,
  })

  return emitCommandResult(
    createSuccessResult<CapabilitiesData>({
      action: 'capabilities',
      data: {
        agents: getAllAgents().map(agent => agent.name),
        features,
        installers,
        outputModes: ['human', 'json', 'ndjson'],
        platform: {
          arch: process.arch,
          os: getPlatform(),
        },
      },
      target: {
        kind: 'system',
        name: 'capabilities',
      },
    }),
    renderCapabilitiesHuman,
  )
}

function getUnavailableReason(
  installer: 'brew' | 'bun' | 'cargo' | 'deno' | 'mise' | 'npm' | 'pip' | 'uv' | 'winget',
): string {
  if (installer === 'winget' && process.platform !== 'win32') return 'not-on-platform'

  if (installer === 'brew' && process.platform === 'win32') return 'not-on-platform'

  return 'not-found'
}

function renderCapabilitiesHuman(result: { data?: CapabilitiesData }): void {
  if (!result.data) return

  const width = getHumanTerminalWidth()
  console.log(pc.bold('\nQuantex Capabilities\n'))
  for (const line of renderHumanFields(
    [
      { label: 'Platform', value: `${result.data.platform.os}/${result.data.platform.arch}` },
      { label: 'Output', value: result.data.outputModes.join(', ') },
      { label: 'Agents', value: `${result.data.agents.length} registered (qtx list)` },
    ],
    { labelStyle: pc.bold, width },
  )) {
    console.log(line)
  }

  const installers = Object.entries(result.data.installers).map(([name, availability]) => ({ availability, name }))
  console.log(pc.bold('\nInstallers\n'))
  for (const line of renderHumanTable(
    installers,
    [
      { header: 'Installer', value: installer => installer.name },
      { header: 'Status', value: installer => formatCapabilityAvailability(installer.availability) },
    ],
    { headerStyle: pc.bold, width },
  )) {
    console.log(line)
  }

  const features = [
    ['--yes', yesNo(result.data.features.assumeYes)],
    ['cache refresh', yesNo(result.data.features.cacheRefresh)],
    ['color modes', result.data.features.colorModes.join(', ')],
    ['no-cache', yesNo(result.data.features.cacheBypass)],
    ['dry-run', yesNo(result.data.features.dryRun)],
    ['freshness metadata', yesNo(result.data.features.freshnessMetadata)],
    ['self-upgrade', yesNo(result.data.features.selfUpgrade)],
    ['idempotency key', yesNo(result.data.features.idempotencyKey)],
    ['log levels', result.data.features.logLevels.join(', ')],
    ['quiet logs', yesNo(result.data.features.quietLogs)],
    ['timeout', yesNo(result.data.features.timeout)],
    ['channels', result.data.features.channels.join(', ')],
    ['exec install policy', result.data.features.execInstallPolicies.join(', ')],
  ].map(([feature, value]) => ({ feature: feature!, value: value! }))
  console.log(pc.bold('\nFeatures\n'))
  for (const line of renderHumanTable(
    features,
    [
      { header: 'Feature', minWidth: 8, value: feature => feature.feature },
      { header: 'Value', minWidth: 8, value: feature => feature.value, wrap: true },
    ],
    { headerStyle: pc.bold, width },
  )) {
    console.log(line)
  }

  console.log()
  for (const line of renderHumanWrapped(pc.dim('Details: qtx capabilities --json'), { indent: '  ', width })) {
    console.log(line)
  }
  console.log()
}

function formatCapabilityAvailability(value: { available: boolean; reason?: string }): string {
  if (value.available) return pc.green('available')

  return pc.red(value.reason ?? 'not-found')
}

function yesNo(value: boolean): string {
  return value ? pc.green('yes') : pc.dim('no')
}
