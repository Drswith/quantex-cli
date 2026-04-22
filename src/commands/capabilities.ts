import type { CommandResult } from '../output/types'
import process from 'node:process'
import pc from 'picocolors'
import { getAllAgents } from '../agents'
import { createSuccessResult, emitCommandResult } from '../output'
import { inspectSelf } from '../self'
import { getPlatform, isBrewAvailable, isBunAvailable, isNpmAvailable, isWingetAvailable } from '../utils/detect'

interface CapabilitiesData {
  agents: string[]
  features: {
    channels: string[]
    dryRun: boolean
    execInstallPolicies: string[]
    selfUpgrade: boolean
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
    npm: {
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
  const [bunAvailable, npmAvailable, brewAvailable, wingetAvailable, selfInspection] = await Promise.all([
    isBunAvailable(),
    isNpmAvailable(),
    isBrewAvailable(),
    isWingetAvailable(),
    inspectSelf(),
  ])

  return emitCommandResult(createSuccessResult<CapabilitiesData>({
    action: 'capabilities',
    data: {
      agents: getAllAgents().map(agent => agent.name),
      features: {
        channels: ['stable', 'beta'],
        dryRun: true,
        execInstallPolicies: ['never', 'if-missing', 'always'],
        selfUpgrade: selfInspection.canAutoUpdate,
      },
      installers: {
        brew: {
          available: brewAvailable,
          reason: brewAvailable ? undefined : getUnavailableReason('brew'),
        },
        bun: {
          available: bunAvailable,
          reason: bunAvailable ? undefined : getUnavailableReason('bun'),
        },
        npm: {
          available: npmAvailable,
          reason: npmAvailable ? undefined : getUnavailableReason('npm'),
        },
        winget: {
          available: wingetAvailable,
          reason: wingetAvailable ? undefined : getUnavailableReason('winget'),
        },
      },
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
  }), renderCapabilitiesHuman)
}

function getUnavailableReason(installer: 'brew' | 'bun' | 'npm' | 'winget'): string {
  if (installer === 'winget' && process.platform !== 'win32')
    return 'not-on-platform'

  if (installer === 'brew' && process.platform === 'win32')
    return 'not-on-platform'

  return 'not-found'
}

function renderCapabilitiesHuman(result: { data?: CapabilitiesData }): void {
  if (!result.data)
    return

  console.log(pc.bold('\nQuantex Capabilities\n'))
  console.log(`  Platform:     ${result.data.platform.os}/${result.data.platform.arch}`)
  console.log(`  Output Modes: ${result.data.outputModes.join(', ')}`)
  console.log(`  Agents:       ${result.data.agents.join(', ')}`)

  console.log(pc.bold('\n  Installers:'))
  console.log(`    bun:    ${formatCapabilityAvailability(result.data.installers.bun)}`)
  console.log(`    npm:    ${formatCapabilityAvailability(result.data.installers.npm)}`)
  console.log(`    brew:   ${formatCapabilityAvailability(result.data.installers.brew)}`)
  console.log(`    winget: ${formatCapabilityAvailability(result.data.installers.winget)}`)

  console.log(pc.bold('\n  Features:'))
  console.log(`    dry-run:              ${result.data.features.dryRun ? 'yes' : 'no'}`)
  console.log(`    self-upgrade:         ${result.data.features.selfUpgrade ? 'yes' : 'no'}`)
  console.log(`    channels:             ${result.data.features.channels.join(', ')}`)
  console.log(`    exec-install-policy:  ${result.data.features.execInstallPolicies.join(', ')}`)
  console.log()
}

function formatCapabilityAvailability(value: { available: boolean, reason?: string }): string {
  if (value.available)
    return pc.green('available')

  return pc.red(value.reason ?? 'not-found')
}
