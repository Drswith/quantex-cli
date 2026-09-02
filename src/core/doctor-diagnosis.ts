import { compareVersions } from '../utils/version'

/**
 * In-repo Core doctor diagnosis engine (CLI-facing). Absent from the published
 * `quantex-core` public API — do not re-export from `src/core/index.ts`.
 */

export type DoctorIssueCategory = 'agent' | 'installers' | 'self'
export type DoctorIssueSubjectKind = 'agent' | 'self' | 'system'
export type DoctorSuggestedAction =
  | 'follow-manual-agent-update'
  | 'inspect-agent-install-source'
  | 'reinstall-self-with-auto-update-source'
  | 'restore-managed-installer'
  | 'restore-self-installer'
  | 'run-agent-self-update'
  | 'run-self-upgrade'

export interface DoctorIssue {
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

export interface DoctorInstallers {
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

export interface DoctorAgentSummary {
  displayName: string
  installedVersion?: string
  latestVersion?: string
  lifecycle: 'managed' | 'unmanaged'
  outdated: boolean
  sourceLabel: string
}

export interface DoctorSelfSummary {
  canAutoUpdate: boolean
  currentVersion: string
  installSource: string
  latestVersion?: string
  outdated: boolean
  recoveryHint?: string
}

export interface DoctorData {
  agents: DoctorAgentSummary[]
  issues: DoctorIssue[]
  installers: DoctorInstallers
  self: DoctorSelfSummary
}

export interface DoctorDiagnosisSelfInput {
  readonly canAutoUpdate: boolean
  readonly currentVersion: string
  readonly installSource: string
  readonly latestVersion?: string
  readonly packageName: string
  readonly recommendedUpgradeCommand?: string
  readonly recoveryHint?: string
  readonly updateChannel: 'beta' | 'stable'
}

export interface DoctorDiagnosisAgentInput {
  readonly displayName: string
  readonly homepage: string
  readonly inPath: boolean
  readonly installedVersion?: string
  readonly latestVersion?: string
  readonly lifecycle: 'managed' | 'unmanaged'
  readonly name: string
  readonly selfUpdateCommand?: string
  readonly sourceLabel: string
  readonly untracked: boolean
}

export interface DoctorDiagnosisDocs {
  readonly selfUpgrade: string
  readonly troubleshooting: string
}

export interface DoctorDiagnosisInput {
  readonly agents: readonly DoctorDiagnosisAgentInput[]
  readonly docs: DoctorDiagnosisDocs
  readonly installers: DoctorInstallers
  readonly self: DoctorDiagnosisSelfInput
}

export function diagnoseDoctorEnvironment(input: DoctorDiagnosisInput): DoctorData {
  const { installers, self } = input
  const {
    brew: brewAvailable,
    bun: bunAvailable,
    cargo: cargoAvailable,
    deno: denoAvailable,
    mise: miseAvailable,
    npm: npmAvailable,
    pip: pipAvailable,
    uv: uvAvailable,
    winget: wingetAvailable,
  } = installers

  const selfOutdated = self.latestVersion ? isVersionNewer(self.latestVersion, self.currentVersion) : false
  const installedAgents = input.agents
    .filter(agent => agent.inPath)
    .map(agent => ({
      displayName: agent.displayName,
      installedVersion: agent.installedVersion,
      latestVersion: agent.latestVersion,
      lifecycle: agent.lifecycle,
      outdated: isAgentOutdated(agent),
      sourceLabel: agent.sourceLabel,
    }))

  const issues: DoctorIssue[] = []

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
      docsRef: input.docs.troubleshooting,
      message:
        'No managed installer found. Install bun, npm, brew, cargo, deno, mise, pip, uv, or winget before relying on managed lifecycle operations.',
      severity: 'warning',
      subject: { kind: 'system' },
      suggestedAction: 'restore-managed-installer',
      suggestedCommands: [],
    })
  }

  if ((self.installSource === 'bun' && !bunAvailable) || (self.installSource === 'npm' && !npmAvailable)) {
    issues.push({
      blocking: true,
      category: 'self',
      code: 'SELF_INSTALLER_MISSING',
      docsRef: input.docs.selfUpgrade,
      message: `Quantex CLI is tracked as a ${self.installSource} install, but ${self.installSource} is not available in PATH. Reinstall that package manager or reinstall Quantex from a supported source.`,
      severity: 'warning',
      subject: { kind: 'self', name: 'quantex' },
      suggestedAction: 'restore-self-installer',
      suggestedCommands: getSelfRecoveryCommands(self.installSource, self.updateChannel, self.packageName),
    })
  }

  if (!self.canAutoUpdate) {
    issues.push({
      blocking: false,
      category: 'self',
      code: 'SELF_AUTO_UPDATE_UNAVAILABLE',
      docsRef: input.docs.selfUpgrade,
      message: `Quantex CLI cannot auto-update from install source "${self.installSource}". Reinstall via bun, npm, or the standalone binary if you want \`quantex upgrade\` support.`,
      severity: 'warning',
      subject: { kind: 'self', name: 'quantex' },
      suggestedAction: 'reinstall-self-with-auto-update-source',
      suggestedCommands: [],
    })
  }

  if (selfOutdated && self.recommendedUpgradeCommand) {
    const recoveryHint = self.recoveryHint
    issues.push({
      blocking: false,
      category: 'self',
      code: 'SELF_UPDATE_AVAILABLE',
      docsRef: input.docs.selfUpgrade,
      message: recoveryHint
        ? `Quantex CLI ${self.currentVersion} is behind ${self.latestVersion}. Run ${self.recommendedUpgradeCommand} or follow: ${recoveryHint}`
        : `Quantex CLI ${self.currentVersion} is behind ${self.latestVersion}. Run ${self.recommendedUpgradeCommand}.`,
      severity: 'warning',
      subject: { kind: 'self', name: 'quantex' },
      suggestedAction: 'run-self-upgrade',
      suggestedCommands: [self.recommendedUpgradeCommand],
    })
  }

  for (const agent of input.agents.filter(candidate => candidate.inPath)) {
    if (agent.untracked) {
      issues.push({
        blocking: false,
        category: 'agent',
        code: 'AGENT_UNTRACKED_IN_PATH',
        docsRef: input.docs.troubleshooting,
        message: `${agent.displayName} is detected on disk but not tracked as a managed Quantex install. Use \`quantex inspect ${agent.name} --json\` to confirm the source, then reinstall through Quantex if you want managed lifecycle operations.`,
        severity: 'warning',
        subject: { kind: 'agent', name: agent.name },
        suggestedAction: 'inspect-agent-install-source',
        suggestedCommands: [`quantex inspect ${agent.name} --json`, `quantex install ${agent.name}`],
      })
    }

    if (!isAgentOutdated(agent)) continue
    if (agent.lifecycle === 'managed') continue

    const hasSelfUpdate = agent.selfUpdateCommand !== undefined
    const recoveryHint = hasSelfUpdate
      ? `Try running ${agent.selfUpdateCommand} directly.`
      : `Check ${agent.homepage} for the recommended update path.`

    issues.push({
      blocking: false,
      category: 'agent',
      code: 'AGENT_MANUAL_UPDATE_REQUIRED',
      docsRef: input.docs.troubleshooting,
      message: `${agent.displayName} ${agent.installedVersion} is behind ${agent.latestVersion}, but the current source is ${agent.sourceLabel}. ${recoveryHint}`,
      severity: 'warning',
      subject: { kind: 'agent', name: agent.name },
      suggestedAction: hasSelfUpdate ? 'run-agent-self-update' : 'follow-manual-agent-update',
      suggestedCommands: hasSelfUpdate && agent.selfUpdateCommand ? [agent.selfUpdateCommand] : [],
    })
  }

  return {
    agents: installedAgents,
    issues,
    installers,
    self: {
      canAutoUpdate: self.canAutoUpdate,
      currentVersion: self.currentVersion,
      installSource: self.installSource,
      latestVersion: self.latestVersion,
      outdated: Boolean(selfOutdated),
      recoveryHint: selfOutdated ? self.recoveryHint : undefined,
    },
  }
}

function isAgentOutdated(agent: DoctorDiagnosisAgentInput): boolean {
  return Boolean(agent.installedVersion && agent.latestVersion && agent.installedVersion !== agent.latestVersion)
}

function isVersionNewer(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) === 1
}

function getSelfRecoveryCommands(
  installSource: string,
  updateChannel: 'beta' | 'stable',
  packageName: string,
): string[] {
  const versionTag = updateChannel === 'beta' ? 'beta' : 'latest'

  if (installSource === 'bun') return [`bun add -g ${packageName}@${versionTag}`]
  if (installSource === 'npm') return [`npm install -g ${packageName}@${versionTag}`]

  return []
}
