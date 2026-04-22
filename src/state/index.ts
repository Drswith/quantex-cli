import type { InstallType, PackageTargetKind } from '../agents/types'
import type { SelfInstallSource } from '../self/types'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { getConfigDir } from '../config'
import { acquireResourceLock, getResourceLockPath } from '../utils/lock'

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

export function getStateLockPath(): string {
  return getResourceLockPath(['state'])
}

export async function loadState(): Promise<QuantexState> {
  return readState()
}

export async function saveState(state: QuantexState): Promise<void> {
  const release = await acquireResourceLock({
    resource: 'state',
    scope: ['state'],
  })

  try {
    await writeState(state)
  }
  finally {
    await release()
  }
}

export async function getInstalledAgentState(agentName: string): Promise<InstalledAgentState | undefined> {
  const state = await loadState()
  return state.installedAgents[agentName]
}

export async function setInstalledAgentState(agentState: InstalledAgentState): Promise<void> {
  await mutateState((state) => {
    state.installedAgents[agentState.agentName] = agentState
  })
}

export async function removeInstalledAgentState(agentName: string): Promise<void> {
  await mutateState((state) => {
    delete state.installedAgents[agentName]
  })
}

export async function getSelfState(): Promise<SelfState> {
  const state = await loadState()
  return state.self
}

export async function setSelfInstallSource(installSource: SelfInstallSource): Promise<void> {
  await mutateState((state) => {
    state.self.installSource = installSource
  })
}

async function readState(): Promise<QuantexState> {
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

async function writeState(state: QuantexState): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true })
  await Bun.write(getStateFilePath(), `${JSON.stringify(state, null, 2)}\n`)
}

async function mutateState(mutator: (state: QuantexState) => void | Promise<void>): Promise<void> {
  const release = await acquireResourceLock({
    resource: 'state',
    scope: ['state'],
  })

  try {
    const state = await readState()
    await mutator(state)
    await writeState(state)
  }
  finally {
    await release()
  }
}
