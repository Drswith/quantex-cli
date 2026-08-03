import type { DesktopClient } from './desktop-client'
import type { DesktopPreferences, DesktopSnapshot, UpdateExecution, UpdateResultItem } from './types'

let preferences: DesktopPreferences = {
  checkFrequency: 'daily',
  launchAtLogin: false,
  notificationsEnabled: true,
}

let snapshot: DesktopSnapshot = {
  checkedAt: '2026-08-03T08:00:00.000Z',
  results: [
    {
      displayName: 'Claude Code',
      installedVersion: '2.1.220',
      latestVersion: '2.1.220',
      name: 'claude-code',
      resource: '@anthropic-ai/claude-code',
      status: 'up-to-date',
      strategy: 'managed/bun',
    },
    {
      displayName: 'Codex CLI',
      installedVersion: '0.146.0',
      latestVersion: '0.147.0',
      name: 'codex',
      resource: '@openai/codex',
      status: 'planned',
      strategy: 'managed/bun',
    },
    {
      displayName: 'Cursor CLI',
      hint: 'This script-managed installation requires confirmation before Quantex runs the update command.',
      installedVersion: '2026.07.23-e383d2b',
      latestVersion: '2026.08.02',
      name: 'cursor',
      resource: 'cursor.com',
      status: 'planned',
      strategy: 'command',
    },
    {
      displayName: 'OpenCode',
      installedVersion: '1.18.11',
      latestVersion: '1.18.11',
      name: 'opencode',
      resource: 'opencode-ai',
      status: 'up-to-date',
      strategy: 'managed/bun',
    },
    {
      displayName: 'Pi',
      hint: 'Quantex needs a manual version check before it can safely update this agent.',
      installedVersion: '0.73.1',
      name: 'pi',
      resource: '@mariozechner/pi-coding-agent',
      status: 'manual-required',
      strategy: 'managed/bun',
    },
    {
      displayName: 'Script agent',
      message: 'Version probe failed. Refresh later or inspect the installation in Quantex CLI.',
      name: 'script-agent',
      resource: 'custom script',
      status: 'failed',
      strategy: 'script',
    },
  ],
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function refreshTimestamp() {
  snapshot = { ...snapshot, checkedAt: new Date().toISOString() }
  return copy(snapshot)
}

export const mockDesktopClient: DesktopClient = {
  applyUpdates: async names => {
    const executions: UpdateExecution[] = []
    snapshot = {
      ...snapshot,
      checkedAt: new Date().toISOString(),
      results: snapshot.results.map(result => {
        if (!names.includes(result.name) || result.status !== 'planned') return result
        const updated: UpdateResultItem = {
          ...result,
          installedVersion: result.latestVersion,
          status: 'updated',
        }
        executions.push({ name: result.name, result: updated })
        return updated
      }),
    }
    return copy(executions)
  },
  cancelUpdates: async () => true,
  getPreferences: async () => copy(preferences),
  getSnapshot: async () => copy(snapshot),
  refreshUpdates: async () => refreshTimestamp(),
  updatePreferences: async nextPreferences => {
    preferences = copy(nextPreferences)
    return copy(preferences)
  },
}
