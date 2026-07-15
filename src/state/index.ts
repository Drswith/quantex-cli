import type { LifecycleReceipt } from '../lifecycle/model'
import type { SelfInstallSource } from '../self/types'
import type { InstalledAgentState, QuantexState, SelfState } from './schema'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { getConfigDir } from '../config'
import { acquireResourceLock, getResourceLockPath } from '../utils/lock'
import { StateSchemaError } from './schema'
import { FileStateDocumentPersistence, LifecycleStateStore, type StateFileSystem } from './store'

export type { InstalledAgentState, QuantexState, SelfState } from './schema'

export class StateFileError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StateFileError'
  }
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

export async function getLifecycleReceipt(targetId: string): Promise<LifecycleReceipt | undefined> {
  try {
    return await createStateStore().getReceipt(targetId)
  } catch (error) {
    if (error instanceof StateFileError) throw error
    throw new StateFileError('Failed to read Quantex state file.', { cause: error })
  }
}

export async function setLifecycleReceipt(receipt: LifecycleReceipt): Promise<void> {
  const release = await acquireResourceLock({
    resource: 'state',
    scope: ['state'],
  })

  try {
    await createStateStore().setReceipt(receipt)
  } catch (error) {
    if (error instanceof StateFileError) throw error
    throw new StateFileError('Failed to write Quantex state file.', { cause: error })
  } finally {
    await release()
  }
}

export async function removeLifecycleReceipt(targetId: string): Promise<void> {
  const release = await acquireResourceLock({
    resource: 'state',
    scope: ['state'],
  })

  try {
    await createStateStore().removeReceipt(targetId)
  } catch (error) {
    if (error instanceof StateFileError) throw error
    throw new StateFileError('Failed to write Quantex state file.', { cause: error })
  } finally {
    await release()
  }
}

export const lifecycleReceiptStore = Object.freeze({
  read: getLifecycleReceipt,
  remove: removeLifecycleReceipt,
  write: setLifecycleReceipt,
})

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

export async function removeSelfInstallSource(): Promise<void> {
  await mutateState(state => {
    delete state.self.installSource
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
    return await createStateStore().loadProjection()
  } catch (error) {
    if (isMissingStateFileError(error)) return { ...defaultState }
    if (error instanceof StateFileError) throw error

    if (error instanceof StateSchemaError) {
      throw new StateFileError(`Failed to read Quantex state file: ${error.message}`, { cause: error })
    }

    throw new StateFileError('Failed to read Quantex state file.', { cause: error })
  }
}

async function writeState(state: QuantexState): Promise<void> {
  try {
    await createStateStore().saveProjection(state)
  } catch (error) {
    if (error instanceof StateFileError) throw error
    throw new StateFileError('Failed to write Quantex state file.', { cause: error })
  }
}

const nodeStateFileSystem: StateFileSystem = {
  async makeDirectory(path) {
    await mkdir(path, { recursive: true })
  },
  async readText(path) {
    return readFile(path, 'utf8')
  },
  async remove(path) {
    await rm(path, { force: true })
  },
  async rename(from, to) {
    await rename(from, to)
  },
  async writeText(path, data) {
    await writeFile(path, data, 'utf8')
  },
}

function createStateStore(): LifecycleStateStore {
  const stateFilePath = getStateFilePath()
  return new LifecycleStateStore(
    new FileStateDocumentPersistence({
      backupFilePath: `${stateFilePath}.v1.bak`,
      directoryPath: getConfigDir(),
      fileSystem: nodeStateFileSystem,
      stateFilePath,
      tempFileSuffix: String(process.pid),
    }),
  )
}

function isMissingStateFileError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined

  return code === 'ENOENT' || code === 'ENOTDIR'
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
