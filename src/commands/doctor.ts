import type { CommandResult } from '../output/types'
import { getAgentUpdateFailureHint, getManualAgentUpdateMessage } from '../agent-update'
import { projectObservationToV1Inspection } from '../compatibility/agent-inspection'
import { BUILD_PACKAGE_NAME } from '../generated/build-meta'
import { createSuccessResult, emitCommandResult } from '../output'
import { getHumanTerminalWidth, renderHumanFields, renderHumanTable, renderHumanWrapped } from '../output/human'
import { createCliOperationContext } from '../runtime/cli-operation-context'
import { getSelfUpgradeRecoveryHintForInspection, inspectSelfReadOnly } from '../self'
import { observeCliReadRegisteredAgents } from '../services/core-read-observations'
import { observeProviderSnapshot, projectProviderSnapshotToV1Installers } from '../services/provider-observations'
import { pc } from '../utils/color'
import { isVersionNewer } from '../utils/version'

type DoctorIssueCategory = 'agent' | 'installers' | 'self'
type DoctorIssueSubjectKind = 'agent' | 'self' | 'system'
type DoctorSuggestedAction =
  | 'follow-manual-agent-update'
  | 'inspect-agent-install-source'
  | 'reinstall-self-with-auto-update-source'
  | 'restore-managed-installer'
  | 'restore-self-installer'
  | 'run-agent-self-update'
  | 'run-self-upgrade'

interface DoctorIssue {
  blocking: boolean
  category: DoctorIssueCategory
  code: string
  docsRef?: string
  message: string
  severity: 'warning'
  subject: {
    kind: DoctorIssueSubjectKind
    name?: string
  }
  suggestedAction: DoctorSuggestedAction
  suggestedCommands: string[]
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
    cargo: boolean
    deno: boolean
    mise: boolean
    npm: boolean
    pip: boolean
    uv: boolean
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
  const operation = createCliOperationContext()
  let providerSnapshot: Awaited<ReturnType<typeof observeProviderSnapshot>>
  let selfInspection: Awaited<ReturnType<typeof inspectSelfReadOnly>>
  let observations: Awaited<ReturnType<typeof observeCliReadRegisteredAgents>>
  try {
    ;[providerSnapshot, selfInspection, observations] = await operation.run(() =>
      Promise.all([
        observeProviderSnapshot({ context: operation.context }),
        inspectSelfReadOnly({ context: operation.context }),
        observeCliReadRegisteredAgents(operation.context),
      ]),
    )
  } finally {
    operation.dispose()
  }
  const installers = projectProviderSnapshotToV1Installers(
    providerSnapshot,
    entry => entry.availability.kind === 'success',
  )
  const { brew: brewAvailable, bun: bunAvailable, cargo: cargoAvailable, deno: denoAvailable } = installers
  const {
    mise: miseAvailable,
    npm: npmAvailable,
    pip: pipAvailable,
    uv: uvAvailable,
    winget: wingetAvailable,
  } = installers
  const selfOutdated = selfInspection.latestVersion
    ? isVersionNewer(selfInspection.latestVersion, selfInspection.currentVersion)
    : false
  const inspections = observations.map(observation => ({
    inspection: projectObservationToV1Inspection(observation),
    observation,
  }))
  const installedAgents = inspections
    .filter(({ inspection }) => inspection.inPath)
    .map(({ inspection }) => ({
      displayName: inspection.agent.displayName,
      installedVersion: inspection.installedVersion,
      latestVersion: inspection.latestVersion,
      lifecycle: inspection.lifecycle,
      outdated: Boolean(
        inspection.installedVersion &&
        inspection.latestVersion &&
        inspection.installedVersion !== inspection.latestVersion,
      ),
      sourceLabel: inspection.sourceLabel,
    }))
  const issues: DoctorIssue[] = []
  const troubleshootingDocsRef = 'docs/runbooks/quantex-troubleshooting.md'
  const selfUpgradeDocsRef = 'docs/runbooks/release-and-self-upgrade-debugging.md'

  if (
    !bunAvailable &&
    !npmAvailable &&
    !brewAvailable &&
    !cargoAvailable &&
    !denoAvailable &&
    !miseAvailable &&
    !pipAvailable &&
    !uvAvailable &&
    !wingetAvailable
  ) {
    issues.push({
      blocking: true,
      category: 'installers',
      code: 'NO_MANAGED_INSTALLER',
      docsRef: troubleshootingDocsRef,
      message:
        'No managed installer found. Install bun, npm, brew, cargo, deno, mise, pip, uv, or winget before relying on managed lifecycle operations.',
      severity: 'warning',
      subject: { kind: 'system' },
      suggestedAction: 'restore-managed-installer',
      suggestedCommands: [],
    })
  }

  if (
    (selfInspection.installSource === 'bun' && !bunAvailable) ||
    (selfInspection.installSource === 'npm' && !npmAvailable)
  ) {
    issues.push({
      blocking: true,
      category: 'self',
      code: 'SELF_INSTALLER_MISSING',
      docsRef: selfUpgradeDocsRef,
      message: `Quantex CLI is tracked as a ${selfInspection.installSource} install, but ${selfInspection.installSource} is not available in PATH. Reinstall that package manager or reinstall Quantex from a supported source.`,
      severity: 'warning',
      subject: { kind: 'self', name: 'quantex' },
      suggestedAction: 'restore-self-installer',
      suggestedCommands: getSelfRecoveryCommands(selfInspection.installSource, selfInspection.updateChannel),
    })
  }

  if (!selfInspection.canAutoUpdate) {
    issues.push({
      blocking: false,
      category: 'self',
      code: 'SELF_AUTO_UPDATE_UNAVAILABLE',
      docsRef: selfUpgradeDocsRef,
      message: `Quantex CLI cannot auto-update from install source "${selfInspection.installSource}". Reinstall via bun, npm, or the standalone binary if you want \`quantex upgrade\` support.`,
      severity: 'warning',
      subject: { kind: 'self', name: 'quantex' },
      suggestedAction: 'reinstall-self-with-auto-update-source',
      suggestedCommands: [],
    })
  }

  if (selfOutdated && selfInspection.recommendedUpgradeCommand) {
    const recoveryHint = getSelfUpgradeRecoveryHintForInspection(selfInspection)
    issues.push({
      blocking: false,
      category: 'self',
      code: 'SELF_UPDATE_AVAILABLE',
      docsRef: selfUpgradeDocsRef,
      message: recoveryHint
        ? `Quantex CLI ${selfInspection.currentVersion} is behind ${selfInspection.latestVersion}. Run ${selfInspection.recommendedUpgradeCommand} or follow: ${recoveryHint}`
        : `Quantex CLI ${selfInspection.currentVersion} is behind ${selfInspection.latestVersion}. Run ${selfInspection.recommendedUpgradeCommand}.`,
      severity: 'warning',
      subject: { kind: 'self', name: 'quantex' },
      suggestedAction: 'run-self-upgrade',
      suggestedCommands: [selfInspection.recommendedUpgradeCommand],
    })
  }

  for (const { inspection, observation } of inspections.filter(candidate => candidate.inspection.inPath)) {
    if (observation.observation.drift.kind === 'untracked') {
      issues.push({
        blocking: false,
        category: 'agent',
        code: 'AGENT_UNTRACKED_IN_PATH',
        docsRef: troubleshootingDocsRef,
        message: `${inspection.agent.displayName} is detected on disk but not tracked as a managed Quantex install. Use \`quantex inspect ${inspection.agent.name} --json\` to confirm the source, then reinstall through Quantex if you want managed lifecycle operations.`,
        severity: 'warning',
        subject: { kind: 'agent', name: inspection.agent.name },
        suggestedAction: 'inspect-agent-install-source',
        suggestedCommands: [
          `quantex inspect ${inspection.agent.name} --json`,
          `quantex install ${inspection.agent.name}`,
        ],
      })
    }

    const outdated = Boolean(
      inspection.installedVersion &&
      inspection.latestVersion &&
      inspection.installedVersion !== inspection.latestVersion,
    )
    if (!outdated) continue

    if (inspection.lifecycle === 'managed') continue

    const recoveryHint =
      getAgentUpdateFailureHint(inspection.agent, inspection.agent.selfUpdate ? 'self-update' : 'manual-hint') ??
      getManualAgentUpdateMessage(inspection.agent)

    issues.push({
      blocking: false,
      category: 'agent',
      code: 'AGENT_MANUAL_UPDATE_REQUIRED',
      docsRef: troubleshootingDocsRef,
      message: `${inspection.agent.displayName} ${inspection.installedVersion} is behind ${inspection.latestVersion}, but the current source is ${inspection.sourceLabel}. ${recoveryHint}`,
      severity: 'warning',
      subject: { kind: 'agent', name: inspection.agent.name },
      suggestedAction: inspection.agent.selfUpdate ? 'run-agent-self-update' : 'follow-manual-agent-update',
      suggestedCommands: inspection.agent.selfUpdate ? [inspection.agent.selfUpdate.command.join(' ')] : [],
    })
  }

  return emitCommandResult(
    createSuccessResult<DoctorData>({
      action: 'doctor',
      data: {
        agents: installedAgents,
        issues,
        installers,
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
    }),
    renderDoctorHuman,
  )
}

function renderDoctorHuman(result: { data?: DoctorData }): void {
  if (!result.data) return

  const width = getHumanTerminalWidth()
  console.log(pc.bold('\nQuantex CLI Environment Check\n'))

  const installers = Object.entries(result.data.installers).map(([name, available]) => ({ available, name }))
  console.log(pc.bold('Managed Installers\n'))
  for (const line of renderHumanTable(
    installers,
    [
      { header: 'Installer', value: installer => installer.name },
      {
        header: 'Status',
        value: installer => (installer.available ? pc.green('available') : pc.red('not found')),
      },
    ],
    { headerStyle: pc.bold, width },
  )) {
    console.log(line)
  }

  const selfFields = [
    { label: 'Version', value: result.data.self.currentVersion },
    { label: 'Source', value: result.data.self.installSource },
    {
      label: 'Auto-update',
      value: result.data.self.canAutoUpdate ? pc.green('supported') : pc.yellow('unsupported'),
    },
    ...(result.data.self.latestVersion
      ? [
          {
            label: 'Latest',
            value: `${result.data.self.latestVersion}${result.data.self.outdated ? pc.yellow(' (update available)') : ''}`,
          },
        ]
      : []),
    ...(result.data.self.recoveryHint ? [{ label: 'Recovery', value: result.data.self.recoveryHint }] : []),
  ]
  console.log(`\n${pc.bold('Quantex CLI')}\n`)
  for (const line of renderHumanFields(selfFields, { labelStyle: pc.bold, width })) console.log(line)

  console.log(`\n${pc.bold('Installed Agents')}\n`)
  if (result.data.agents.length === 0) {
    console.log(pc.dim('  No agents installed'))
  } else {
    for (const line of renderHumanTable(
      result.data.agents,
      [
        { header: 'Agent', minWidth: 8, value: agent => agent.displayName },
        {
          header: 'Version',
          maxWidth: 24,
          value: agent =>
            agent.outdated && agent.latestVersion
              ? pc.yellow(`${agent.installedVersion ?? 'unknown'} → ${agent.latestVersion}`)
              : (agent.installedVersion ?? 'unknown'),
        },
        { header: 'Lifecycle', optional: true, priority: 2, value: agent => agent.lifecycle },
        { header: 'Source', optional: true, priority: 1, value: agent => pc.dim(agent.sourceLabel) },
      ],
      { headerStyle: pc.bold, width },
    )) {
      console.log(line)
    }
  }

  console.log(`\n${pc.bold('Issues')}\n`)
  if (result.data.issues.length === 0) {
    console.log(pc.green('  No issues found.'))
  } else {
    for (const issue of result.data.issues) {
      for (const line of renderHumanWrapped(pc.yellow(issue.message), {
        continuationIndent: '    ',
        indent: '  - ',
        width,
      })) {
        console.log(line)
      }
      if (issue.suggestedCommands.length > 0) {
        for (const line of renderHumanWrapped(pc.dim(`Next: ${issue.suggestedCommands.join(' | ')}`), {
          indent: '    ',
          width,
        })) {
          console.log(line)
        }
      }
    }
  }

  console.log()
}

function getSelfRecoveryCommands(installSource: string, updateChannel: 'stable' | 'beta'): string[] {
  const versionTag = updateChannel === 'beta' ? 'beta' : 'latest'

  if (installSource === 'bun') return [`bun add -g ${BUILD_PACKAGE_NAME}@${versionTag}`]
  if (installSource === 'npm') return [`npm install -g ${BUILD_PACKAGE_NAME}@${versionTag}`]

  return []
}
