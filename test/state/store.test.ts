import type { StateDocumentPersistence, StateFileSystem } from '../../src/state/store'
import { describe, expect, it } from 'vitest'
import {
  CURRENT_STATE_SCHEMA_VERSION,
  LIFECYCLE_RECEIPT_SCHEMA_VERSION,
  type VersionedQuantexState,
} from '../../src/state/schema'
import { FileStateDocumentPersistence, LifecycleStateStore } from '../../src/state/store'

class MemoryPersistence implements StateDocumentPersistence {
  saved: VersionedQuantexState[] = []

  constructor(private value: unknown | undefined) {}

  async load(): Promise<unknown | undefined> {
    return structuredClone(this.value)
  }

  async save(document: VersionedQuantexState): Promise<void> {
    this.value = structuredClone(document)
    this.saved.push(structuredClone(document))
  }
}

describe('LifecycleStateStore', () => {
  it('returns the v1 projection from a current document', async () => {
    const persistence = new MemoryPersistence(currentDocument())
    const store = new LifecycleStateStore(persistence)

    expect(await store.loadProjection()).toEqual({
      installedAgents: {},
      self: {},
    })
  })

  it('preserves lifecycle receipts when saving the v1 projection', async () => {
    const persistence = new MemoryPersistence(currentDocument())
    const store = new LifecycleStateStore(persistence)

    await store.saveProjection({
      installedAgents: {
        claude: {
          agentName: 'claude',
          installType: 'npm',
        },
      },
      self: {},
    })

    expect(persistence.saved).toHaveLength(1)
    expect(persistence.saved[0]?.installedAgents).toHaveProperty('claude')
    expect(persistence.saved[0]?.lifecycleReceipts).toHaveProperty('codex')
  })

  it('writes and removes only verified receipt-shaped evidence', async () => {
    const persistence = new MemoryPersistence(undefined)
    const store = new LifecycleStateStore(persistence)

    await store.setReceipt({
      kind: 'lifecycle-receipt',
      providerId: 'bun',
      providerTargetId: '@openai/codex',
      schemaVersion: LIFECYCLE_RECEIPT_SCHEMA_VERSION,
      targetId: 'codex',
      verifiedAt: '2026-07-12T00:00:00.000Z',
    })

    expect(await store.getReceipt('codex')).toMatchObject({ targetId: 'codex' })

    await store.removeReceipt('codex')

    expect(await store.getReceipt('codex')).toBeUndefined()
  })

  it('atomically records installed state and verified lifecycle evidence', async () => {
    const persistence = new MemoryPersistence(currentDocument())
    const store = new LifecycleStateStore(persistence)

    await store.setAgentLifecycleEvidence(
      { agentName: 'claude', installType: 'npm', packageName: '@anthropic-ai/claude-code' },
      {
        kind: 'lifecycle-receipt',
        providerId: 'npm',
        providerTargetId: '@anthropic-ai/claude-code',
        schemaVersion: LIFECYCLE_RECEIPT_SCHEMA_VERSION,
        targetId: 'claude',
        verifiedAt: '2026-07-15T00:00:00.000Z',
      },
    )

    expect(persistence.saved).toHaveLength(1)
    expect(persistence.saved[0]?.installedAgents.claude).toMatchObject({ installType: 'npm' })
    expect(persistence.saved[0]?.lifecycleReceipts.claude).toMatchObject({ providerId: 'npm' })
    expect(persistence.saved[0]?.lifecycleReceipts.codex).toBeDefined()
  })

  it('rejects mismatched installed state and receipt targets before saving', async () => {
    const persistence = new MemoryPersistence(currentDocument())
    const store = new LifecycleStateStore(persistence)

    await expect(
      store.setAgentLifecycleEvidence(
        { agentName: 'claude', installType: 'npm' },
        {
          kind: 'lifecycle-receipt',
          providerId: 'npm',
          providerTargetId: '@openai/codex',
          schemaVersion: LIFECYCLE_RECEIPT_SCHEMA_VERSION,
          targetId: 'codex',
          verifiedAt: '2026-07-15T00:00:00.000Z',
        },
      ),
    ).rejects.toThrow('must target the same agent')
    expect(persistence.saved).toHaveLength(0)
  })
})

describe('FileStateDocumentPersistence', () => {
  it('reads legacy state without mutating the filesystem', async () => {
    const legacy = `${JSON.stringify({ installedAgents: {}, self: {} }, null, 2)}\n`
    const fileSystem = new MemoryFileSystem({ '/config/state.json': legacy })
    const persistence = filePersistence(fileSystem)

    expect(await persistence.load()).toEqual({ installedAgents: {}, self: {} })
    expect(fileSystem.snapshot()).toEqual({ '/config/state.json': legacy })
  })

  it('retains a validated byte-for-byte backup before migrating legacy state', async () => {
    const legacy = `${JSON.stringify(
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
    const fileSystem = new MemoryFileSystem({ '/config/state.json': legacy })
    const store = new LifecycleStateStore(filePersistence(fileSystem))

    await store.saveProjection({
      installedAgents: {
        codex: {
          agentName: 'codex',
          installType: 'bun',
        },
      },
      self: {
        installSource: 'binary',
      },
    })

    expect(fileSystem.read('/config/state.json.v1.bak')).toBe(legacy)
    expect(JSON.parse(fileSystem.read('/config/state.json'))).toEqual({
      installedAgents: {
        codex: {
          agentName: 'codex',
          installType: 'bun',
        },
      },
      lifecycleReceipts: {},
      schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
      self: {
        installSource: 'binary',
      },
    })
    expect(fileSystem.paths().some(path => path.includes('.tmp-'))).toBe(false)
  })
})

function currentDocument(): VersionedQuantexState {
  return {
    installedAgents: {},
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

function filePersistence(fileSystem: StateFileSystem): FileStateDocumentPersistence {
  return new FileStateDocumentPersistence({
    backupFilePath: '/config/state.json.v1.bak',
    directoryPath: '/config',
    fileSystem,
    stateFilePath: '/config/state.json',
    tempFileSuffix: 'test',
  })
}

class MemoryFileSystem implements StateFileSystem {
  private readonly files: Map<string, string>

  constructor(initial: Record<string, string>) {
    this.files = new Map(Object.entries(initial))
  }

  async makeDirectory(): Promise<void> {}

  async readText(path: string): Promise<string> {
    const value = this.files.get(path)
    if (value === undefined) throw Object.assign(new Error(`Missing ${path}`), { code: 'ENOENT' })
    return value
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path)
  }

  async rename(from: string, to: string): Promise<void> {
    const value = await this.readText(from)
    this.files.set(to, value)
    this.files.delete(from)
  }

  async writeText(path: string, data: string): Promise<void> {
    this.files.set(path, data)
  }

  paths(): string[] {
    return [...this.files.keys()]
  }

  read(path: string): string {
    const value = this.files.get(path)
    if (value === undefined) throw new Error(`Missing ${path}`)
    return value
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.files)
  }
}
