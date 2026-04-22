import type { InstallType, PackageTargetKind } from '../agents/types'
import type { SelfInstallSource } from '../self/types'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { getConfigDir } from '../config'

export interface InstalledAgentState {
  agentName: string
  installType: InstallType
  packageName?: string
  packageTargetKind?: PackageTargetKind
  command?: string
}

export interface SelfState {
  installSource?: SelfInstallSource
}

export interface QuantexState {
  installedAgents: Record<string, InstalledAgentState>
  self: SelfState
}

const defaultState: QuantexState = {
  installedAgents: {},
  self: {},
}

export function getStateFilePath(): string {
  return join(getConfigDir(), 'state.json')
}

export async function loadState(): Promise<QuantexState> {
  try {
    const data = await Bun.file(getStateFilePath()).json() as Partial<QuantexState>
    return {
      installedAgents: data.installedAgents ?? {},
      self: data.self ?? {},
    }
  }
  catch {
    return { ...defaultState }
  }
}

export async function saveState(state: QuantexState): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true })
  await Bun.write(getStateFilePath(), `${JSON.stringify(state, null, 2)}\n`)
}

export async function getInstalledAgentState(agentName: string): Promise<InstalledAgentState | undefined> {
  const state = await loadState()
  return state.installedAgents[agentName]
}

export async function setInstalledAgentState(agentState: InstalledAgentState): Promise<void> {
  const state = await loadState()
  state.installedAgents[agentState.agentName] = agentState
  await saveState(state)
}

export async function removeInstalledAgentState(agentName: string): Promise<void> {
  const state = await loadState()
  delete state.installedAgents[agentName]
  await saveState(state)
}

export async function getSelfState(): Promise<SelfState> {
  const state = await loadState()
  return state.self
}

export async function setSelfInstallSource(installSource: SelfInstallSource): Promise<void> {
  const state = await loadState()
  state.self.installSource = installSource
  await saveState(state)
}
