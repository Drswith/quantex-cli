import type {
  AgentDetails,
  AgentSummary,
  DesktopPreferences,
  DesktopSnapshot,
  DiagnosticsSnapshot,
  LifecycleAction,
  LifecycleExecution,
  QuantexConfig,
  UpdateExecution,
} from './types'
import { invoke } from '@tauri-apps/api/core'
import { mockDesktopClient } from './mock-desktop-client'

export interface DesktopClient {
  applyUpdates: (names: string[]) => Promise<UpdateExecution[]>
  cancelUpdates: () => Promise<boolean>
  getAgent: (name: string) => Promise<AgentDetails>
  getAgents: () => Promise<AgentSummary[]>
  getDiagnostics: () => Promise<DiagnosticsSnapshot>
  getPreferences: () => Promise<DesktopPreferences>
  getQuantexConfig: () => Promise<QuantexConfig>
  getSnapshot: () => Promise<DesktopSnapshot>
  openAgentTerminal: (name: string) => Promise<LifecycleExecution>
  refreshUpdates: () => Promise<DesktopSnapshot>
  resetQuantexConfig: () => Promise<QuantexConfig>
  runLifecycleAction: (action: LifecycleAction, name: string) => Promise<LifecycleExecution>
  setQuantexConfig: (key: keyof QuantexConfig, value: number | string) => Promise<QuantexConfig>
  updatePreferences: (preferences: DesktopPreferences) => Promise<DesktopPreferences>
}

const tauriDesktopClient: DesktopClient = {
  applyUpdates: names => invoke<UpdateExecution[]>('apply_updates', { names }),
  cancelUpdates: () => invoke<boolean>('cancel_updates'),
  getAgent: name => invoke<AgentDetails>('get_agent', { name }),
  getAgents: () => invoke<AgentSummary[]>('get_agents'),
  getDiagnostics: () => invoke<DiagnosticsSnapshot>('get_diagnostics'),
  getPreferences: () => invoke<DesktopPreferences>('get_preferences'),
  getQuantexConfig: () => invoke<QuantexConfig>('get_quantex_config'),
  getSnapshot: () => invoke<DesktopSnapshot>('get_snapshot'),
  openAgentTerminal: name => invoke<LifecycleExecution>('open_agent_terminal', { name }),
  refreshUpdates: () => invoke<DesktopSnapshot>('refresh_updates'),
  resetQuantexConfig: () => invoke<QuantexConfig>('reset_quantex_config'),
  runLifecycleAction: (action, name) => invoke<LifecycleExecution>('run_lifecycle_action', { action, name }),
  setQuantexConfig: (key, value) => invoke<QuantexConfig>('set_quantex_config', { key, value }),
  updatePreferences: preferences => invoke<DesktopPreferences>('update_preferences', { preferences }),
}

export const isBrowserPreview = typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)
export const desktopClient = isBrowserPreview ? mockDesktopClient : tauriDesktopClient
