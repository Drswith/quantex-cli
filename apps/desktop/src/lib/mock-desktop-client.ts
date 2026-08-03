import type { DesktopClient } from './desktop-client'
import type {
  AgentDetails,
  AgentSummary,
  DesktopPreferences,
  DesktopSnapshot,
  DiagnosticsSnapshot,
  LifecycleExecution,
  QuantexConfig,
  UpdateExecution,
  UpdateResultItem,
} from './types'

let preferences: DesktopPreferences = {
  checkFrequency: 'daily',
  launchAtLogin: false,
  notificationsEnabled: true,
}

let config: QuantexConfig = {
  defaultPackageManager: 'bun',
  networkRetries: 2,
  networkTimeoutMs: 10000,
  npmBunUpdateStrategy: 'latest-major',
  selfUpdateChannel: 'stable',
  selfUpdateRegistry: 'https://registry.npmjs.org',
  versionCacheTtlHours: 6,
}

let agents: AgentSummary[] = [
  {
    binaryName: 'codex',
    displayName: 'Codex CLI',
    installed: true,
    installedVersion: '0.146.0',
    latestVersion: '0.147.0',
    lifecycle: 'managed',
    name: 'codex',
    sourceLabel: 'managed via bun',
    updateLabel: 'managed update',
  },
  {
    binaryName: 'claude',
    displayName: 'Claude Code',
    installed: true,
    installedVersion: '2.1.232',
    latestVersion: '2.1.232',
    lifecycle: 'managed',
    name: 'claude',
    sourceLabel: 'managed via bun',
    updateLabel: 'managed update',
  },
  {
    binaryName: 'cursor-agent',
    displayName: 'Cursor CLI',
    installed: true,
    installedVersion: '2026.07.23-e383d2b',
    latestVersion: '2026.08.02',
    lifecycle: 'managed',
    name: 'cursor',
    sourceLabel: 'script installer',
    updateLabel: 'command update',
  },
  {
    binaryName: 'opencode',
    displayName: 'OpenCode',
    installed: true,
    installedVersion: '1.18.11',
    latestVersion: '1.18.11',
    lifecycle: 'unmanaged',
    name: 'opencode',
    sourceLabel: 'detected on disk',
    updateLabel: 'self update',
  },
  {
    binaryName: 'gemini',
    displayName: 'Gemini CLI',
    installed: false,
    latestVersion: '0.12.1',
    lifecycle: 'unmanaged',
    name: 'gemini',
    sourceLabel: 'not installed',
    updateLabel: 'managed update',
  },
  {
    binaryName: 'pi',
    displayName: 'Pi',
    installed: false,
    latestVersion: '0.74.0',
    lifecycle: 'unmanaged',
    name: 'pi',
    sourceLabel: 'not installed',
    updateLabel: 'managed update',
  },
]

let snapshot: DesktopSnapshot = {
  checkedAt: '2026-08-14T01:18:00.000Z',
  results: [
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
      hint: 'Quantex will re-check the script source before updating.',
      installedVersion: '2026.07.23-e383d2b',
      latestVersion: '2026.08.02',
      name: 'cursor',
      resource: 'cursor.com',
      status: 'planned',
      strategy: 'command',
    },
    {
      displayName: 'Claude Code',
      installedVersion: '2.1.232',
      latestVersion: '2.1.232',
      name: 'claude',
      resource: '@anthropic-ai/claude-code',
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
      message: 'Version probe failed. Refresh later or inspect the installation.',
      name: 'script-agent',
      resource: 'custom script',
      status: 'failed',
      strategy: 'script',
    },
  ],
}

const diagnostics: DiagnosticsSnapshot = {
  agents: agents
    .filter(agent => agent.installed)
    .map(agent => ({
      displayName: agent.displayName,
      installedVersion: agent.installedVersion,
      latestVersion: agent.latestVersion,
      lifecycle: agent.lifecycle,
      outdated: agent.installedVersion !== agent.latestVersion,
      sourceLabel: agent.sourceLabel,
    })),
  installers: {
    brew: { available: true },
    bun: { available: true },
    cargo: { available: true },
    deno: { available: false, reason: 'not-found' },
    mise: { available: true },
    npm: { available: true },
    pip: { available: true },
    uv: { available: true },
    winget: { available: false, reason: 'not-on-platform' },
  },
  issues: [
    {
      blocking: false,
      category: 'agent',
      code: 'AGENT_UNTRACKED_IN_PATH',
      message: 'OpenCode is available on disk but is not tracked by Quantex.',
      subject: { kind: 'agent', name: 'opencode' },
    },
  ],
  platform: { arch: 'arm64', os: 'darwin' },
  self: {
    canAutoUpdate: false,
    currentVersion: '1.9.4',
    installSource: 'desktop-sidecar',
    latestVersion: '1.9.4',
    outdated: false,
  },
}

function copy<T>(value: T): T {
  return structuredClone(value)
}

function detailsFor(agent: AgentSummary): AgentDetails {
  return {
    agent: {
      aliases: agent.name === 'claude' ? ['claude-code'] : [],
      binaryName: agent.binaryName,
      displayName: agent.displayName,
      installMethods: [
        { command: `bun add -g ${agent.name}`, label: 'Bun package', type: 'bun' },
        { command: `npm install -g ${agent.name}`, label: 'npm package', type: 'npm' },
      ],
      name: agent.name,
      packageName: agent.name,
    },
    capabilities: {
      canAutoInstall: true,
      canAutoUninstall: agent.installed && agent.lifecycle === 'managed',
      canRun: agent.installed,
      canSelfUpdate: agent.installed,
    },
    inspection: {
      binaryPath: agent.installed ? `/opt/homebrew/bin/${agent.binaryName}` : undefined,
      installed: agent.installed,
      installedVersion: agent.installedVersion,
      latestVersion: agent.latestVersion,
      lifecycle: agent.lifecycle,
      sourceLabel: agent.installed ? agent.sourceLabel : undefined,
      updateLabel: agent.updateLabel,
    },
  }
}

function result(action: LifecycleExecution['action'], name: string, changed: boolean): LifecycleExecution {
  const agent = agents.find(candidate => candidate.name === name)
  return {
    action,
    changed,
    message: `${agent?.displayName ?? name}: ${action} completed.`,
    name,
    ok: true,
    timestamp: new Date().toISOString(),
  }
}

export const mockDesktopClient: DesktopClient = {
  applyUpdates: async names => {
    const executions: UpdateExecution[] = []
    snapshot = {
      ...snapshot,
      checkedAt: new Date().toISOString(),
      results: snapshot.results.map(item => {
        if (!names.includes(item.name) || item.status !== 'planned') return item
        const updated: UpdateResultItem = {
          ...item,
          installedVersion: item.latestVersion,
          status: 'updated',
        }
        executions.push({ name: item.name, result: updated })
        return updated
      }),
    }
    agents = agents.map(agent => {
      const update = snapshot.results.find(item => item.name === agent.name && item.status === 'updated')
      return update ? { ...agent, installedVersion: update.latestVersion } : agent
    })
    return copy(executions)
  },
  cancelUpdates: async () => true,
  getAgent: async name => {
    const agent = agents.find(candidate => candidate.name === name)
    if (!agent) throw new Error(`Unknown agent: ${name}`)
    return copy(detailsFor(agent))
  },
  getAgents: async () => copy(agents),
  getDiagnostics: async () => copy(diagnostics),
  getPreferences: async () => copy(preferences),
  getQuantexConfig: async () => copy(config),
  getSnapshot: async () => copy(snapshot),
  openAgentTerminal: async name => result('exec', name, false),
  refreshUpdates: async () => {
    snapshot = { ...snapshot, checkedAt: new Date().toISOString() }
    return copy(snapshot)
  },
  resetQuantexConfig: async () => {
    config = {
      defaultPackageManager: 'bun',
      networkRetries: 2,
      networkTimeoutMs: 10000,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    }
    return copy(config)
  },
  runLifecycleAction: async (action, name) => {
    const changed = action !== 'ensure'
    agents = agents.map(agent => {
      if (agent.name !== name) return agent
      if (action === 'install' || action === 'ensure') {
        return { ...agent, installed: true, installedVersion: agent.latestVersion, lifecycle: 'managed' as const }
      }
      if (action === 'uninstall') {
        return { ...agent, installed: false, installedVersion: undefined, lifecycle: 'unmanaged' as const }
      }
      if (action === 'update') return { ...agent, installedVersion: agent.latestVersion }
      return agent
    })
    return result(action, name, changed)
  },
  setQuantexConfig: async (key, value) => {
    config = { ...config, [key]: value }
    return copy(config)
  },
  updatePreferences: async next => {
    preferences = copy(next)
    return copy(preferences)
  },
}
