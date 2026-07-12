import type { LifecycleReceipt } from '../../src/lifecycle/model'
import type { StateFileSystem } from '../../src/state/store'
import { describe, expect, it } from 'vitest'
import {
  CURRENT_STATE_SCHEMA_VERSION,
  LIFECYCLE_RECEIPT_SCHEMA_VERSION,
  StateSchemaError,
  type VersionedQuantexState,
} from '../../src/state/schema'
import { FileStateDocumentPersistence, LifecycleStateStore, StateRecoveryError } from '../../src/state/store'

const STATE_PATH = '/config/state.json'
const BACKUP_PATH = `${STATE_PATH}.v1.bak`

describe('state migration fault recovery', () => {
  it.each([
    ['backup write', { failWritePath: `${BACKUP_PATH}.tmp-test` }],
    ['state replacement', { failRenameTo: STATE_PATH }],
  ] as const)('leaves legacy state intact after interrupted %s', async (_name, faults) => {
    const legacy = legacyPayload()
    const fileSystem = new FaultInjectingFileSystem({ [STATE_PATH]: legacy }, faults)
    const store = new LifecycleStateStore(filePersistence(fileSystem))

    await expect(store.saveProjection({ installedAgents: {}, self: { installSource: 'binary' } })).rejects.toThrow()

    expect(fileSystem.read(STATE_PATH)).toBe(legacy)
    expect(fileSystem.paths().some(path => path.includes('.tmp-') || path.includes('.restore-'))).toBe(false)
  })

  it('restores original bytes when committed state fails post-write validation', async () => {
    const legacy = legacyPayload()
    const fileSystem = new FaultInjectingFileSystem({ [STATE_PATH]: legacy }, { corruptFirstRenameTo: STATE_PATH })
    const store = new LifecycleStateStore(filePersistence(fileSystem))

    await expect(store.saveProjection({ installedAgents: {}, self: { installSource: 'binary' } })).rejects.toThrow()

    expect(fileSystem.read(STATE_PATH)).toBe(legacy)
    expect(fileSystem.read(BACKUP_PATH)).toBe(legacy)
  })

  it.each([
    ['restore write', { corruptRenameToCalls: { [STATE_PATH]: [1] }, failWritePath: `${STATE_PATH}.restore-test` }],
    ['restore rename', { corruptRenameToCalls: { [STATE_PATH]: [1] }, failRenameToCalls: { [STATE_PATH]: [2] } }],
    ['restored content', { corruptRenameToCalls: { [STATE_PATH]: [1, 2] } }],
  ] as const)('retains a recoverable backup when %s fails', async (_name, faults) => {
    const legacy = legacyPayload()
    const fileSystem = new FaultInjectingFileSystem({ [STATE_PATH]: legacy }, faults)
    const store = new LifecycleStateStore(filePersistence(fileSystem))

    const error = await store
      .saveProjection({ installedAgents: {}, self: { installSource: 'binary' } })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(StateRecoveryError)
    expect(error).toMatchObject({ backupFilePath: BACKUP_PATH })
    expect(fileSystem.read(BACKUP_PATH)).toBe(legacy)
    expect(fileSystem.paths().some(path => path.includes('.tmp-') || path.includes('.restore-'))).toBe(false)
  })

  it('fails closed on an unsupported future document schema', async () => {
    const fileSystem = new FaultInjectingFileSystem({
      [STATE_PATH]: `${JSON.stringify({
        installedAgents: {},
        lifecycleReceipts: {},
        schemaVersion: CURRENT_STATE_SCHEMA_VERSION + 1,
        self: {},
      })}\n`,
    })
    const store = new LifecycleStateStore(filePersistence(fileSystem))

    await expect(store.loadProjection()).rejects.toBeInstanceOf(StateSchemaError)
    await expect(store.saveProjection({ installedAgents: {}, self: {} })).rejects.toBeInstanceOf(StateSchemaError)
  })

  it('rebuilds a receipt only from newly supplied verification evidence after an older rewrite', async () => {
    const fileSystem = new FaultInjectingFileSystem({
      [STATE_PATH]: `${JSON.stringify(currentDocument())}\n`,
    })
    const store = new LifecycleStateStore(filePersistence(fileSystem))

    fileSystem.overwrite(STATE_PATH, legacyPayload())

    expect(await store.getReceipt('codex')).toBeUndefined()
    expect((await store.loadProjection()).installedAgents.codex).toMatchObject({ installType: 'bun' })

    const verifiedReceipt: LifecycleReceipt = {
      kind: 'lifecycle-receipt',
      providerId: 'bun',
      providerTargetId: '@openai/codex',
      schemaVersion: LIFECYCLE_RECEIPT_SCHEMA_VERSION,
      targetId: 'codex',
      verifiedAt: '2026-07-12T01:00:00.000Z',
      version: '1.2.3',
    }
    await store.setReceipt(verifiedReceipt)

    expect(await store.getReceipt('codex')).toEqual(verifiedReceipt)
    expect(JSON.parse(fileSystem.read(STATE_PATH)).installedAgents.codex).toMatchObject({ installType: 'bun' })
  })

  it('rejects receipt rebuilding without valid verification evidence', async () => {
    const fileSystem = new FaultInjectingFileSystem({ [STATE_PATH]: legacyPayload() })
    const store = new LifecycleStateStore(filePersistence(fileSystem))

    await expect(
      store.setReceipt({
        kind: 'lifecycle-receipt',
        providerId: 'bun',
        providerTargetId: '@openai/codex',
        schemaVersion: LIFECYCLE_RECEIPT_SCHEMA_VERSION,
        targetId: 'codex',
        verifiedAt: '',
      }),
    ).rejects.toBeInstanceOf(StateSchemaError)

    expect(JSON.parse(fileSystem.read(STATE_PATH))).not.toHaveProperty('lifecycleReceipts')
  })
})

function filePersistence(fileSystem: StateFileSystem): FileStateDocumentPersistence {
  return new FileStateDocumentPersistence({
    backupFilePath: BACKUP_PATH,
    directoryPath: '/config',
    fileSystem,
    stateFilePath: STATE_PATH,
    tempFileSuffix: 'test',
  })
}

function legacyPayload(): string {
  return `${JSON.stringify(
    {
      installedAgents: {
        codex: {
          agentName: 'codex',
          installType: 'bun',
        },
      },
      self: {},
    },
    null,
    2,
  )}\n`
}

function currentDocument(): VersionedQuantexState {
  return {
    installedAgents: {
      codex: {
        agentName: 'codex',
        installType: 'bun',
      },
    },
    lifecycleReceipts: {
      codex: {
        kind: 'lifecycle-receipt',
        providerId: 'bun',
        providerTargetId: '@openai/codex',
        schemaVersion: LIFECYCLE_RECEIPT_SCHEMA_VERSION,
        targetId: 'codex',
        verifiedAt: '2026-07-12T00:00:00.000Z',
      },
    },
    schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
    self: {},
  }
}

interface Faults {
  readonly corruptFirstRenameTo?: string
  readonly corruptRenameToCalls?: Readonly<Record<string, readonly number[]>>
  readonly failRenameToCalls?: Readonly<Record<string, readonly number[]>>
  readonly failRenameTo?: string
  readonly failWritePath?: string
}

class FaultInjectingFileSystem implements StateFileSystem {
  private corruptedRename = false
  private readonly files: Map<string, string>
  private readonly renameCalls = new Map<string, number>()

  constructor(
    initial: Record<string, string>,
    private readonly faults: Faults = {},
  ) {
    this.files = new Map(Object.entries(initial))
  }

  async makeDirectory(): Promise<void> {}

  async readText(path: string): Promise<string> {
    return this.read(path)
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path)
  }

  async rename(from: string, to: string): Promise<void> {
    const renameCall = (this.renameCalls.get(to) ?? 0) + 1
    this.renameCalls.set(to, renameCall)
    if (this.faults.failRenameTo === to) throw new Error(`Injected rename failure for ${to}`)
    if (this.faults.failRenameToCalls?.[to]?.includes(renameCall)) {
      throw new Error(`Injected rename failure ${renameCall} for ${to}`)
    }
    const value = this.read(from)
    const corrupt =
      (this.faults.corruptFirstRenameTo === to && !this.corruptedRename) ||
      Boolean(this.faults.corruptRenameToCalls?.[to]?.includes(renameCall))
    this.files.set(to, corrupt ? '{corrupt-after-rename' : value)
    this.corruptedRename ||= this.faults.corruptFirstRenameTo === to
    this.files.delete(from)
  }

  async writeText(path: string, data: string): Promise<void> {
    if (this.faults.failWritePath === path) throw new Error(`Injected write failure for ${path}`)
    this.files.set(path, data)
  }

  overwrite(path: string, data: string): void {
    this.files.set(path, data)
  }

  paths(): string[] {
    return [...this.files.keys()]
  }

  read(path: string): string {
    const value = this.files.get(path)
    if (value === undefined) throw Object.assign(new Error(`Missing ${path}`), { code: 'ENOENT' })
    return value
  }
}
