import type { LifecycleReceipt } from '../lifecycle/model'
import type { InstalledAgentState, QuantexState, VersionedQuantexState } from './schema'
import {
  createEmptyStateDocument,
  normalizeLifecycleReceipt,
  parseStateDocument,
  projectQuantexState,
  replaceLegacyProjection,
} from './schema'

export interface StateDocumentPersistence {
  load(): Promise<unknown | undefined>
  save(document: VersionedQuantexState): Promise<void>
}

export interface StateFileSystem {
  makeDirectory(path: string): Promise<void>
  readText(path: string): Promise<string>
  remove(path: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  writeText(path: string, data: string): Promise<void>
}

export interface FileStateDocumentPersistenceOptions {
  readonly backupFilePath: string
  readonly directoryPath: string
  readonly fileSystem: StateFileSystem
  readonly stateFilePath: string
  readonly tempFileSuffix: string
}

export class StateRecoveryError extends Error {
  readonly backupFilePath: string
  readonly primaryError: unknown
  readonly recoveryError: unknown

  constructor(input: { backupFilePath: string; primaryError: unknown; recoveryError: unknown }) {
    super('Failed to restore the original Quantex state after a persistence failure.', {
      cause: input.recoveryError,
    })
    this.name = 'StateRecoveryError'
    this.backupFilePath = input.backupFilePath
    this.primaryError = input.primaryError
    this.recoveryError = input.recoveryError
  }
}

export class FileStateDocumentPersistence implements StateDocumentPersistence {
  constructor(private readonly options: FileStateDocumentPersistenceOptions) {}

  async load(): Promise<unknown | undefined> {
    const raw = await this.readOptional(this.options.stateFilePath)
    return raw === undefined ? undefined : parseJson(raw)
  }

  async save(document: VersionedQuantexState): Promise<void> {
    const validated = parseStateDocument(document)
    if (validated.source !== 'current') throw new Error('Refusing to persist an unversioned state document.')

    const { backupFilePath, directoryPath, stateFilePath, tempFileSuffix } = this.options
    const backupTempFilePath = `${backupFilePath}.tmp-${tempFileSuffix}`
    const stateTempFilePath = `${stateFilePath}.tmp-${tempFileSuffix}`
    const restoreTempFilePath = `${stateFilePath}.restore-${tempFileSuffix}`
    const original = await this.readOptional(stateFilePath)
    const originalParsed = original === undefined ? undefined : parseStateDocument(parseJson(original))
    const payload = `${JSON.stringify(validated.document, null, 2)}\n`
    let stateReplaced = false

    await this.options.fileSystem.makeDirectory(directoryPath)

    try {
      if (original !== undefined && originalParsed?.source === 'legacy') {
        await this.options.fileSystem.writeText(backupTempFilePath, original)
        await this.validateBackup(backupTempFilePath, original)
        await this.options.fileSystem.rename(backupTempFilePath, backupFilePath)
        await this.validateBackup(backupFilePath, original)
      }

      await this.options.fileSystem.writeText(stateTempFilePath, payload)
      validateCurrentPayload(await this.options.fileSystem.readText(stateTempFilePath))
      await this.options.fileSystem.rename(stateTempFilePath, stateFilePath)
      stateReplaced = true
      validateCurrentPayload(await this.options.fileSystem.readText(stateFilePath))
    } catch (primaryError) {
      let recoveryError: unknown
      try {
        if (stateReplaced) await this.restoreOriginal(original, restoreTempFilePath, stateFilePath)
      } catch (error) {
        recoveryError = error
      } finally {
        await this.removeTemporaryFiles(backupTempFilePath, stateTempFilePath, restoreTempFilePath)
      }

      if (recoveryError !== undefined) {
        throw new StateRecoveryError({ backupFilePath, primaryError, recoveryError })
      }
      throw primaryError
    }

    await this.removeTemporaryFiles(backupTempFilePath, stateTempFilePath, restoreTempFilePath)
  }

  private async readOptional(path: string): Promise<string | undefined> {
    try {
      return await this.options.fileSystem.readText(path)
    } catch (error) {
      if (isMissingFileError(error)) return undefined
      throw error
    }
  }

  private async validateBackup(path: string, original: string): Promise<void> {
    const backup = await this.options.fileSystem.readText(path)
    if (backup !== original) throw new Error('State migration backup does not match the original state.')
    parseStateDocument(parseJson(backup))
  }

  private async restoreOriginal(original: string | undefined, restorePath: string, statePath: string): Promise<void> {
    if (original === undefined) {
      await this.options.fileSystem.remove(statePath)
      if ((await this.readOptional(statePath)) !== undefined)
        throw new Error('New state remained after rollback removal.')
      return
    }

    await this.options.fileSystem.writeText(restorePath, original)
    await this.options.fileSystem.rename(restorePath, statePath)
    const restored = await this.options.fileSystem.readText(statePath)
    if (restored !== original) throw new Error('Restored state does not match the original state.')
    parseStateDocument(parseJson(restored))
  }

  private async removeTemporaryFiles(...paths: string[]): Promise<void> {
    await Promise.all(paths.map(path => this.options.fileSystem.remove(path).catch(() => undefined)))
  }
}

export class LifecycleStateStore {
  constructor(private readonly persistence: StateDocumentPersistence) {}

  async loadDocument(): Promise<VersionedQuantexState> {
    const value = await this.persistence.load()
    return value === undefined ? createEmptyStateDocument() : parseStateDocument(value).document
  }

  async loadProjection(): Promise<QuantexState> {
    return projectQuantexState(await this.loadDocument())
  }

  async saveDocument(document: VersionedQuantexState): Promise<void> {
    const validated = parseStateDocument(document)
    if (validated.source !== 'current') throw new Error('State documents must use the current state schema.')
    await this.persistence.save(validated.document)
  }

  async saveProjection(projection: QuantexState): Promise<void> {
    const document = replaceLegacyProjection(await this.loadDocument(), projection)
    await this.saveDocument(document)
  }

  async getReceipt(targetId: string): Promise<LifecycleReceipt | undefined> {
    return (await this.loadDocument()).lifecycleReceipts[targetId]
  }

  async setReceipt(receipt: LifecycleReceipt): Promise<void> {
    const normalized = normalizeLifecycleReceipt(receipt.targetId, receipt)
    const document = await this.loadDocument()
    const next = {
      ...document,
      lifecycleReceipts: {
        ...document.lifecycleReceipts,
        [normalized.targetId]: normalized,
      },
    }
    const validated = parseStateDocument(next)
    if (validated.source !== 'current')
      throw new Error('Verified lifecycle evidence must use the current state schema.')
    await this.saveDocument(validated.document)
  }

  async setAgentLifecycleEvidence(installedState: InstalledAgentState, receipt: LifecycleReceipt): Promise<void> {
    const normalized = normalizeLifecycleReceipt(receipt.targetId, receipt)
    if (installedState.agentName !== normalized.targetId) {
      throw new Error('Installed agent state and lifecycle receipt must target the same agent.')
    }
    const document = await this.loadDocument()
    const next = {
      ...document,
      installedAgents: {
        ...document.installedAgents,
        [installedState.agentName]: installedState,
      },
      lifecycleReceipts: {
        ...document.lifecycleReceipts,
        [normalized.targetId]: normalized,
      },
    }
    const validated = parseStateDocument(next)
    if (validated.source !== 'current')
      throw new Error('Verified lifecycle evidence must use the current state schema.')
    await this.saveDocument(validated.document)
  }

  async removeReceipt(targetId: string): Promise<void> {
    const document = await this.loadDocument()
    const lifecycleReceipts = { ...document.lifecycleReceipts }
    delete lifecycleReceipts[targetId]
    await this.saveDocument({ ...document, lifecycleReceipts })
  }
}

function parseJson(raw: string): unknown {
  return JSON.parse(raw) as unknown
}

function validateCurrentPayload(raw: string): void {
  const parsed = parseStateDocument(parseJson(raw))
  if (parsed.source !== 'current') throw new Error('Persisted state validation did not produce a current document.')
}

function isMissingFileError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined
  return code === 'ENOENT' || code === 'ENOTDIR'
}
