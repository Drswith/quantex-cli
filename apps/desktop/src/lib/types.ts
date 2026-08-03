export type CheckFrequency = '6h' | 'daily' | 'disabled' | 'weekly'

export interface DesktopPreferences {
  checkFrequency: CheckFrequency
  launchAtLogin: boolean
  notificationsEnabled: boolean
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
