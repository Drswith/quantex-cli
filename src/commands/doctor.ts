import type { CommandResult } from '../output/types'
import pc from 'picocolors'
import { createSuccessResult, emitCommandResult } from '../output'
import { getSelfUpgradeRecoveryHintForInspection, inspectSelf } from '../self'
import { inspectRegisteredAgents } from '../services/agents'
import { isBrewAvailable, isBunAvailable, isNpmAvailable, isWingetAvailable } from '../utils/detect'

interface DoctorIssue {
  code: string
  message: string
  severity: 'warning'
}

interface DoctorData {
  agents: Array<{
    displayName: string
    installedVersion?: string
    latestVersion?: string
    lifecycle: 'managed' | 'unmanaged'
    outdated: boolean
    sourceLabel: string
  }>
  issues: DoctorIssue[]
  installers: {
    brew: boolean
    bun: boolean
    npm: boolean
    winget: boolean
  }
  self: {
    canAutoUpdate: boolean
    currentVersion: string
    installSource: string
    latestVersion?: string
    outdated: boolean
    recoveryHint?: string
  }
}

export async function doctorCommand(): Promise<CommandResult<DoctorData>> {
  const bunAvailable = await isBunAvailable()
  const npmAvailable = await isNpmAvailable()
  const brewAvailable = await isBrewAvailable()
  const wingetAvailable = await isWingetAvailable()

  const selfInspection = await inspectSelf()
  const selfOutdated = selfInspection.latestVersion && selfInspection.latestVersion !== selfInspection.currentVersion
  const inspections = await inspectRegisteredAgents()
  const installedAgents = inspections
    .filter(inspection => inspection.inPath)
    .map(inspection => ({
      displayName: inspection.agent.displayName,
      installedVersion: inspection.installedVersion,
      latestVersion: inspection.latestVersion,
      lifecycle: inspection.lifecycle,
      outdated: Boolean(inspection.installedVersion && inspection.latestVersion && inspection.installedVersion !== inspection.latestVersion),
      sourceLabel: inspection.sourceLabel,
    }))
  const issues: DoctorIssue[] = []

  if (!bunAvailable && !npmAvailable && !brewAvailable && !wingetAvailable) {
    issues.push({
      code: 'NO_MANAGED_INSTALLER',
      message: 'No managed installer found. Install bun, npm, brew, or winget.',
      severity: 'warning',
    })
  }

  return emitCommandResult(createSuccessResult<DoctorData>({
    action: 'doctor',
    data: {
      agents: installedAgents,
      issues,
      installers: {
        brew: brewAvailable,
        bun: bunAvailable,
        npm: npmAvailable,
        winget: wingetAvailable,
      },
      self: {
        canAutoUpdate: selfInspection.canAutoUpdate,
        currentVersion: selfInspection.currentVersion,
        installSource: selfInspection.installSource,
        latestVersion: selfInspection.latestVersion,
        outdated: Boolean(selfOutdated),
        recoveryHint: selfOutdated ? getSelfUpgradeRecoveryHintForInspection(selfInspection) : undefined,
      },
    },
    target: {
      kind: 'system',
      name: 'doctor',
    },
  }), renderDoctorHuman)
}

function renderDoctorHuman(result: { data?: DoctorData }): void {
  if (!result.data)
    return

  console.log(pc.bold('\nQuantex CLI Environment Check\n'))

  console.log(pc.bold('Managed Installers:'))
  console.log(`  Bun:   ${result.data.installers.bun ? pc.green('available') : pc.red('not found')}`)
  console.log(`  npm:   ${result.data.installers.npm ? pc.green('available') : pc.red('not found')}`)
  console.log(`  brew:  ${result.data.installers.brew ? pc.green('available') : pc.red('not found')}`)
  console.log(`  winget:${result.data.installers.winget ? pc.green('available') : pc.red('not found')}`)

  console.log(`\n${pc.bold('Quantex CLI:')}`)
  console.log(`  Version:      ${result.data.self.currentVersion}`)
  console.log(`  Source:       ${result.data.self.installSource}`)
  console.log(`  Auto-update:  ${result.data.self.canAutoUpdate ? pc.green('supported') : pc.yellow('unsupported')}`)
  if (result.data.self.latestVersion) {
    console.log(`  Latest:       ${result.data.self.latestVersion}${result.data.self.outdated ? pc.yellow(' (update available)') : ''}`)
  }
  if (result.data.self.recoveryHint)
    console.log(`  Recovery:     ${result.data.self.recoveryHint}`)

  console.log(`\n${pc.bold('Installed Agents:')}`)
  if (result.data.agents.length === 0) {
    console.log(pc.dim('  No agents installed'))
  }
  else {
    for (const agent of result.data.agents) {
      console.log(`  ${agent.displayName}: ${agent.installedVersion ?? 'unknown'} [${agent.lifecycle}; ${agent.sourceLabel}]${agent.outdated ? pc.yellow(` (update available: ${agent.latestVersion})`) : ''}`)
    }
  }

  console.log(`\n${pc.bold('Issues:')}`)
  if (result.data.issues.length === 0) {
    console.log(pc.green('  No issues found.'))
  }
  else {
    for (const issue of result.data.issues)
      console.log(pc.yellow(`  - ${issue.message}`))
  }

  console.log()
}
