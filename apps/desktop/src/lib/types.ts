export type CheckFrequency = '6h' | 'daily' | 'disabled' | 'weekly'
export type AppearancePreference = 'dark' | 'light' | 'system'

export interface DesktopPreferences {
  appearance: AppearancePreference
  checkFrequency: CheckFrequency
  launchAtLogin: boolean
  notificationsEnabled: boolean
}

export interface AgentSummary {
  binaryName: string
  displayName: string
  installed: boolean
  installedVersion?: string
  latestVersion?: string
  lifecycle: 'managed' | 'unmanaged'
  name: string
  sourceLabel: string
  updateLabel: string
}

export interface AgentDetails {
  agent: {
    aliases: string[]
    binaryName: string
    displayName: string
    installMethods: Array<{ command: string; label: string; type: string }>
    name: string
    packageName?: string
  }
  capabilities: {
    canAutoInstall: boolean
    canAutoUninstall: boolean
    canRun: boolean
    canSelfUpdate: boolean
  }
  inspection: {
    binaryPath?: string
    installed: boolean
    installedVersion?: string
    latestVersion?: string
    lifecycle: 'managed' | 'unmanaged'
    sourceLabel?: string
    updateLabel: string
  }
}

export type LifecycleAction = 'ensure' | 'install' | 'uninstall' | 'update'

export interface LifecycleExecution {
  action: LifecycleAction | 'exec'
  changed: boolean
  error?: string
  message: string
  name: string
  ok: boolean
  timestamp: string
}

export interface UpdateResultItem {
  displayName: string
  hint?: string
  installedVersion?: string
  latestVersion?: string
  message?: string
  name: string
  resource?: string
  status: 'failed' | 'locked' | 'manual-required' | 'planned' | 'up-to-date' | 'updated'
  strategy?: string
}

export interface DesktopSnapshot {
  checkedAt?: string
  error?: string
  results: UpdateResultItem[]
}

export interface UpdateExecution {
  error?: string
  name: string
  result?: UpdateResultItem
}

export interface DoctorIssue {
  blocking: boolean
  category: 'agent' | 'installers' | 'self'
  code: string
  message: string
  subject: { kind: 'agent' | 'self' | 'system'; name?: string }
}

export interface DiagnosticsSnapshot {
  agents: Array<{
    displayName: string
    installedVersion?: string
    latestVersion?: string
    lifecycle: 'managed' | 'unmanaged'
    outdated: boolean
    sourceLabel: string
  }>
  installers: Record<string, { available: boolean; reason?: string }>
  issues: DoctorIssue[]
  platform: { arch: string; os: string }
  self: {
    canAutoUpdate: boolean
    currentVersion: string
    installSource: string
    latestVersion?: string
    outdated: boolean
  }
}

export interface QuantexConfig {
  defaultPackageManager: 'bun' | 'mise' | 'npm' | 'uv'
  networkRetries: number
  networkTimeoutMs: number
  npmBunUpdateStrategy: 'latest-major' | 'respect-semver'
  selfUpdateChannel: 'beta' | 'stable'
  selfUpdateRegistry?: string
  versionCacheTtlHours: number
}
