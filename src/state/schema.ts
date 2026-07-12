import type { InstallType, PackageTargetKind } from '../agents/types'
import type { LifecycleReceipt } from '../lifecycle/model'
import type { SelfInstallSource } from '../self/types'
import { isManagedInstallType } from '../utils/install'

export const CURRENT_STATE_SCHEMA_VERSION = 2 as const
export const LIFECYCLE_RECEIPT_SCHEMA_VERSION = 1 as const

export class StateSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StateSchemaError'
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

export interface VersionedQuantexState extends QuantexState {
  lifecycleReceipts: Record<string, LifecycleReceipt>
  schemaVersion: typeof CURRENT_STATE_SCHEMA_VERSION
}

export interface ParsedStateDocument {
  document: VersionedQuantexState
  source: 'current' | 'legacy'
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

export function createEmptyStateDocument(): VersionedQuantexState {
  return {
    installedAgents: {},
    lifecycleReceipts: {},
    schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
    self: {},
  }
}

export function parseStateDocument(value: unknown): ParsedStateDocument {
  if (!isPlainObject(value)) {
    throw new StateSchemaError('root value must be an object.')
  }

  const source = value.schemaVersion === undefined ? 'legacy' : 'current'

  if (source === 'current' && value.schemaVersion !== CURRENT_STATE_SCHEMA_VERSION) {
    throw new StateSchemaError(`unsupported schemaVersion "${String(value.schemaVersion)}".`)
  }

  return {
    document: {
      installedAgents: normalizeInstalledAgents(value.installedAgents),
      lifecycleReceipts: source === 'current' ? normalizeLifecycleReceipts(value.lifecycleReceipts) : {},
      schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
      self: normalizeSelfState(value.self),
    },
    source,
  }
}

export function projectQuantexState(document: VersionedQuantexState): QuantexState {
  return {
    installedAgents: document.installedAgents,
    self: document.self,
  }
}

export function replaceLegacyProjection(
  document: VersionedQuantexState,
  projection: QuantexState,
): VersionedQuantexState {
  const normalized = parseStateDocument(projection).document

  return {
    installedAgents: normalized.installedAgents,
    lifecycleReceipts: document.lifecycleReceipts,
    schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
    self: normalized.self,
  }
}

export function normalizeLifecycleReceipt(targetId: string, value: unknown): LifecycleReceipt {
  if (!isPlainObject(value)) {
    throw new StateSchemaError(`lifecycle receipt "${targetId}" must be an object.`)
  }

  if (value.kind !== 'lifecycle-receipt') {
    throw new StateSchemaError(`lifecycle receipt "${targetId}" has an invalid kind.`)
  }
  if (value.schemaVersion !== LIFECYCLE_RECEIPT_SCHEMA_VERSION) {
    throw new StateSchemaError(`lifecycle receipt "${targetId}" has an unsupported schemaVersion.`)
  }
  if (!isNonEmptyString(value.targetId) || value.targetId !== targetId) {
    throw new StateSchemaError(`lifecycle receipt "${targetId}" has an invalid targetId.`)
  }
  if (!isNonEmptyString(value.providerId)) {
    throw new StateSchemaError(`lifecycle receipt "${targetId}" has an invalid providerId.`)
  }
  if (!isNonEmptyString(value.providerTargetId)) {
    throw new StateSchemaError(`lifecycle receipt "${targetId}" has an invalid providerTargetId.`)
  }
  if (value.providerTargetKind !== undefined && !isProviderTargetKind(value.providerTargetKind)) {
    throw new StateSchemaError(`lifecycle receipt "${targetId}" has an invalid providerTargetKind.`)
  }
  if (!isValidTimestamp(value.verifiedAt)) {
    throw new StateSchemaError(`lifecycle receipt "${targetId}" has an invalid verifiedAt.`)
  }

  const receipt: LifecycleReceipt = {
    ...(isNonEmptyString(value.executableName) ? { executableName: value.executableName } : {}),
    ...(isNonEmptyString(value.executablePath) ? { executablePath: value.executablePath } : {}),
    kind: 'lifecycle-receipt',
    providerId: value.providerId,
    providerTargetId: value.providerTargetId,
    ...(isProviderTargetKind(value.providerTargetKind) ? { providerTargetKind: value.providerTargetKind } : {}),
    schemaVersion: LIFECYCLE_RECEIPT_SCHEMA_VERSION,
    targetId,
    verifiedAt: value.verifiedAt,
    ...(isNonEmptyString(value.version) ? { version: value.version } : {}),
  }

  return receipt
}

function normalizeLifecycleReceipts(value: unknown): Record<string, LifecycleReceipt> {
  if (!isPlainObject(value)) {
    throw new StateSchemaError('lifecycleReceipts must be an object.')
  }

  return Object.fromEntries(
    Object.entries(value).map(([targetId, receipt]) => [targetId, normalizeLifecycleReceipt(targetId, receipt)]),
  )
}

function normalizeInstalledAgents(value: unknown): Record<string, InstalledAgentState> {
  if (value === undefined) return {}
  if (!isPlainObject(value)) {
    throw new StateSchemaError('installedAgents must be an object.')
  }

  return Object.fromEntries(
    Object.entries(value).map(([agentName, agentState]) => [
      agentName,
      normalizeInstalledAgentState(agentName, agentState),
    ]),
  )
}

function normalizeInstalledAgentState(agentName: string, value: unknown): InstalledAgentState {
  if (!isPlainObject(value)) {
    throw new StateSchemaError(`installed agent "${agentName}" must be an object.`)
  }
  if (value.agentName !== agentName) {
    throw new StateSchemaError(`installed agent "${agentName}" has an invalid agentName.`)
  }
  if (!isInstallType(value.installType)) {
    throw new StateSchemaError(`installed agent "${agentName}" has an invalid installType.`)
  }

  const state: InstalledAgentState = {
    agentName,
    installType: value.installType,
  }

  if (typeof value.binaryName === 'string') state.binaryName = value.binaryName
  if (Array.isArray(value.packageInstallArgs) && value.packageInstallArgs.every(isString)) {
    state.packageInstallArgs = value.packageInstallArgs
  }
  if (typeof value.packageName === 'string') {
    if (value.packageName.length === 0 && isManagedInstallType(value.installType)) {
      throw new StateSchemaError(`installed agent "${agentName}" has an empty packageName.`)
    }
    state.packageName = value.packageName
  }
  if (isPackageTargetKind(value.packageTargetKind)) state.packageTargetKind = value.packageTargetKind
  if (typeof value.command === 'string') state.command = value.command

  return state
}

function normalizeSelfState(value: unknown): SelfState {
  if (!isPlainObject(value)) return {}

  const self: SelfState = { ...value }

  if (isSelfInstallSource(value.installSource)) self.installSource = value.installSource
  else delete self.installSource

  if (typeof value.updateNoticeAt === 'string') self.updateNoticeAt = value.updateNoticeAt
  else delete self.updateNoticeAt

  if (typeof value.updateNoticeVersion === 'string') self.updateNoticeVersion = value.updateNoticeVersion
  else delete self.updateNoticeVersion

  return self
}

function isInstallType(value: unknown): value is InstallType {
  return typeof value === 'string' && VALID_INSTALL_TYPES.has(value as InstallType)
}

function isPackageTargetKind(value: unknown): value is PackageTargetKind {
  return value === 'package' || value === 'cask' || value === 'id'
}

function isProviderTargetKind(
  value: unknown,
): value is 'binary' | 'cask' | 'formula' | 'id' | 'package' | 'script' | 'tool' {
  return (
    value === 'binary' ||
    value === 'cask' ||
    value === 'formula' ||
    value === 'id' ||
    value === 'package' ||
    value === 'script' ||
    value === 'tool'
  )
}

function isSelfInstallSource(value: unknown): value is SelfInstallSource {
  return value === 'binary' || value === 'bun' || value === 'npm' || value === 'source' || value === 'unknown'
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isValidTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
