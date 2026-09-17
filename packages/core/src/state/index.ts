// KEEP (S3): Core-owned persisted state (schema, store, receipts, self projection).
// Live importers across Core engines, package-manager, and the CLI v1 barrel.
// Not a leftover pass-through of config or self-upgrade UI.
// S3 leftover scan: KEEP product-path hang here (Core-internal leftover; do not restore src/lifecycle).
import type { LifecycleReceipt } from '../lifecycle/model'
import type { InstalledAgentState, QuantexState, SelfInstallSource, SelfState } from './schema'
import type { LifecycleStateStore } from './store'
import { acquireResourceLockInConfigDir, getResourceLockPathInConfigDir } from '../../../../src/utils/lock'
import { createFileLifecycleStateStore, getStateFilePathInConfigDir } from './file-store'
import { getStateHostPorts } from './host'
import { StateSchemaError } from './schema'

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

function configDir(): string {
  return getStateHostPorts().configDir()
}

async function acquireStateLock(): Promise<() => Promise<void>> {
  return await acquireResourceLockInConfigDir(configDir(), {
    resource: 'state',
    scope: ['state'],
  })
}

export function getStateFilePath(): string {
  return getStateFilePathInConfigDir(configDir())
}

export function getStateLockPath(): string {
  return getResourceLockPathInConfigDir(configDir(), ['state'])
}

export async function loadState(): Promise<QuantexState> {
  return readState()
}

export async function saveState(state: QuantexState): Promise<void> {
  const release = await acquireStateLock()

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
  const release = await acquireStateLock()

  try {
    await createStateStore().setReceipt(receipt)
  } catch (error) {
    if (error instanceof StateFileError) throw error
    throw new StateFileError('Failed to write Quantex state file.', { cause: error })
  } finally {
    await release()
  }
}

export async function setAgentLifecycleEvidence(
  installedState: InstalledAgentState,
  receipt: LifecycleReceipt,
): Promise<void> {
  const release = await acquireStateLock()

  try {
    await createStateStore().setAgentLifecycleEvidence(installedState, receipt)
  } catch (error) {
    if (error instanceof StateFileError) throw error
    throw new StateFileError('Failed to write Quantex state file.', { cause: error })
  } finally {
    await release()
  }
}

export async function removeLifecycleReceipt(targetId: string): Promise<void> {
  const release = await acquireStateLock()

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

function createStateStore(): LifecycleStateStore {
  return createFileLifecycleStateStore(configDir())
}

function isMissingStateFileError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined

  return code === 'ENOENT' || code === 'ENOTDIR'
}

async function mutateState(mutator: (state: QuantexState) => void | Promise<void>): Promise<void> {
  const release = await acquireStateLock()

  try {
    const state = await readState()
    await mutator(state)
    await writeState(state)
  } finally {
    await release()
  }
}
