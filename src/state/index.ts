import type { InstallType, PackageTargetKind } from '../agents/types'
import type { SelfInstallSource } from '../self/types'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { getConfigDir } from '../config'
import { acquireResourceLock, getResourceLockPath } from '../utils/lock'

export class StateFileError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StateFileError'
  }
}

export interface InstalledAgentState {
  agentName: string
  binaryName?: string
  installType: InstallType
  packageInstallArgs?: string[]
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
      installedAgents: normalizeInstalledAgents(data.installedAgents),
      self,
    }
  } catch (error) {
    if (isMissingStateFileError(error)) return { ...defaultState }
    if (error instanceof StateFileError) throw error

    throw new StateFileError('Failed to read Quantex state file.', { cause: error })
  }
}

const VALID_INSTALL_TYPES = new Set<InstallType>([
  'binary',
  'brew',
  'bun',
  'cargo',
  'deno',
  'mise',
  'npm',
  'pip',
  'script',
  'uv',
  'winget',
])

function normalizeInstalledAgents(rawInstalledAgents: unknown): Record<string, InstalledAgentState> {
  if (rawInstalledAgents === undefined) return {}

  if (!isPlainObject(rawInstalledAgents)) {
    throw new StateFileError('Failed to read Quantex state file: installedAgents must be an object.')
  }

  const installedAgents: Record<string, InstalledAgentState> = {}

  for (const [agentName, rawAgentState] of Object.entries(rawInstalledAgents)) {
    installedAgents[agentName] = normalizeInstalledAgentState(agentName, rawAgentState)
  }

  return installedAgents
}

function normalizeInstalledAgentState(agentName: string, rawAgentState: unknown): InstalledAgentState {
  if (!isPlainObject(rawAgentState)) {
    throw new StateFileError(`Failed to read Quantex state file: installed agent "${agentName}" must be an object.`)
  }

  if (typeof rawAgentState.agentName !== 'string' || rawAgentState.agentName !== agentName) {
    throw new StateFileError(
      `Failed to read Quantex state file: installed agent "${agentName}" has an invalid agentName.`,
    )
  }

  if (!isInstallType(rawAgentState.installType)) {
    throw new StateFileError(
      `Failed to read Quantex state file: installed agent "${agentName}" has an invalid installType.`,
    )
  }

  const agentState: InstalledAgentState = {
    agentName,
    installType: rawAgentState.installType,
  }

  if (typeof rawAgentState.binaryName === 'string') agentState.binaryName = rawAgentState.binaryName
  if (Array.isArray(rawAgentState.packageInstallArgs) && rawAgentState.packageInstallArgs.every(isString)) {
    agentState.packageInstallArgs = rawAgentState.packageInstallArgs
  }
  if (typeof rawAgentState.packageName === 'string') agentState.packageName = rawAgentState.packageName
  if (isPackageTargetKind(rawAgentState.packageTargetKind)) {
    agentState.packageTargetKind = rawAgentState.packageTargetKind
  }
  if (typeof rawAgentState.command === 'string') agentState.command = rawAgentState.command

  return agentState
}

function isInstallType(value: unknown): value is InstallType {
  return typeof value === 'string' && VALID_INSTALL_TYPES.has(value as InstallType)
}

function isPackageTargetKind(value: unknown): value is PackageTargetKind {
  return value === 'package' || value === 'cask' || value === 'id'
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
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

  const stateFilePath = getStateFilePath()
  const tempFilePath = `${stateFilePath}.tmp-${process.pid}`
  const payload = `${JSON.stringify(state, null, 2)}\n`

  try {
    await writeFile(tempFilePath, payload, 'utf8')
    await rename(tempFilePath, stateFilePath)
  } catch (error) {
    await rm(tempFilePath, { force: true })
    throw error
  }
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
