import type { InstallType, PackageTargetKind } from '../agents/types'
import type { SelfInstallSource } from '../self/types'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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
  updateNoticeAt?: string
  updateNoticeVersion?: string
  [key: string]: unknown
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
  } finally {
    await release()
  }
}

export async function getInstalledAgentState(agentName: string): Promise<InstalledAgentState | undefined> {
  const state = await loadState()
  return state.installedAgents[agentName]
}

export async function setInstalledAgentState(agentState: InstalledAgentState): Promise<void> {
  await mutateState(state => {
    state.installedAgents[agentState.agentName] = agentState
  })
}

export async function removeInstalledAgentState(agentName: string): Promise<void> {
  await mutateState(state => {
    delete state.installedAgents[agentName]
  })
}

export async function getSelfState(): Promise<SelfState> {
  const state = await loadState()
  return state.self
}

export async function setSelfInstallSource(installSource: SelfInstallSource): Promise<void> {
  await mutateState(state => {
    state.self.installSource = installSource
  })
}

export async function setSelfUpdateNoticeState(updateNoticeVersion: string, updateNoticeAt: string): Promise<void> {
  await mutateState(state => {
    state.self.updateNoticeVersion = updateNoticeVersion
    state.self.updateNoticeAt = updateNoticeAt
  })
}

async function readState(): Promise<QuantexState> {
  try {
    const data = JSON.parse(await readFile(getStateFilePath(), 'utf8')) as Partial<QuantexState>
    const self = normalizeSelfState(data.self)

    return {
      installedAgents: data.installedAgents ?? {},
      self,
    }
  } catch {
    return { ...defaultState }
  }
}

function normalizeSelfState(rawSelf: unknown): SelfState {
  if (!isPlainObject(rawSelf)) return {}

  const self: SelfState = { ...rawSelf }

  if (isSelfInstallSource(rawSelf.installSource)) {
    self.installSource = rawSelf.installSource
  } else {
    delete self.installSource
  }

  if (typeof rawSelf.updateNoticeAt === 'string') {
    self.updateNoticeAt = rawSelf.updateNoticeAt
  } else {
    delete self.updateNoticeAt
  }

  if (typeof rawSelf.updateNoticeVersion === 'string') {
    self.updateNoticeVersion = rawSelf.updateNoticeVersion
  } else {
    delete self.updateNoticeVersion
  }

  return self
}

function isSelfInstallSource(value: unknown): value is SelfInstallSource {
  return value === 'binary' || value === 'bun' || value === 'npm' || value === 'source' || value === 'unknown'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function writeState(state: QuantexState): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true })
  await writeFile(getStateFilePath(), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
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
  } finally {
    await release()
  }
}
