import { describe, expect, it } from 'vitest'
import {
  CURRENT_STATE_SCHEMA_VERSION,
  LIFECYCLE_RECEIPT_SCHEMA_VERSION,
  StateSchemaError,
  parseStateDocument,
  projectQuantexState,
  replaceLegacyProjection,
} from '../../src/state/schema'

describe('state schema', () => {
  it('normalizes legacy state into the current internal document', () => {
    const parsed = parseStateDocument({
      installedAgents: {
        codex: {
          agentName: 'codex',
          installType: 'bun',
        },
      },
      self: {
        installSource: 'npm',
      },
    })

    expect(parsed.source).toBe('legacy')
    expect(parsed.document).toEqual({
      installedAgents: {
        codex: {
          agentName: 'codex',
          installType: 'bun',
        },
      },
      lifecycleReceipts: {},
      schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
      self: {
        installSource: 'npm',
      },
    })
  })

  it('loads a current document with a validated lifecycle receipt', () => {
    const parsed = parseStateDocument({
      installedAgents: {},
      lifecycleReceipts: {
        codex: {
          executablePath: '/usr/local/bin/codex',
          kind: 'lifecycle-receipt',
          providerId: 'bun',
          providerTargetId: '@openai/codex',
          schemaVersion: LIFECYCLE_RECEIPT_SCHEMA_VERSION,
          targetId: 'codex',
          verifiedAt: '2026-07-12T00:00:00.000Z',
          version: '1.2.3',
        },
      },
      schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
      self: {},
    })

    expect(parsed.source).toBe('current')
    expect(parsed.document.lifecycleReceipts.codex).toMatchObject({
      providerId: 'bun',
      providerTargetId: '@openai/codex',
      targetId: 'codex',
      verifiedAt: '2026-07-12T00:00:00.000Z',
    })
  })

  it('keeps the public v1 projection free of schema and receipt fields', () => {
    const parsed = parseStateDocument({
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
    })

    expect(projectQuantexState(parsed.document)).toEqual({
      installedAgents: {},
      self: {},
    })
  })

  it('preserves receipts when replacing only the legacy projection', () => {
    const original = parseStateDocument({
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
    }).document

    const replaced = replaceLegacyProjection(original, {
      installedAgents: {
        claude: {
          agentName: 'claude',
          installType: 'npm',
        },
      },
      self: {
        installSource: 'binary',
      },
    })

    expect(replaced.installedAgents).toHaveProperty('claude')
    expect(replaced.lifecycleReceipts).toEqual(original.lifecycleReceipts)
    expect(replaced.self).toEqual({ installSource: 'binary' })
  })

  it.each([
    {
      installedAgents: {},
      lifecycleReceipts: {},
      schemaVersion: CURRENT_STATE_SCHEMA_VERSION + 1,
      self: {},
    },
    {
      installedAgents: {},
      lifecycleReceipts: {
        codex: {
          kind: 'lifecycle-receipt',
          providerId: 'bun',
          providerTargetId: '@openai/codex',
          schemaVersion: LIFECYCLE_RECEIPT_SCHEMA_VERSION + 1,
          targetId: 'codex',
          verifiedAt: '2026-07-12T00:00:00.000Z',
        },
      },
      schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
      self: {},
    },
    {
      installedAgents: {},
      lifecycleReceipts: {
        codex: {
          kind: 'lifecycle-receipt',
          providerId: 'bun',
          providerTargetId: '@openai/codex',
          schemaVersion: LIFECYCLE_RECEIPT_SCHEMA_VERSION,
          targetId: 'another-agent',
          verifiedAt: '2026-07-12T00:00:00.000Z',
        },
      },
      schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
      self: {},
    },
    {
      installedAgents: {},
      lifecycleReceipts: {
        codex: {
          kind: 'lifecycle-receipt',
          providerId: 'brew',
          providerTargetId: 'codex',
          providerTargetKind: 'not-a-target-kind',
          schemaVersion: LIFECYCLE_RECEIPT_SCHEMA_VERSION,
          targetId: 'codex',
          verifiedAt: '2026-07-12T00:00:00.000Z',
        },
      },
      schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
      self: {},
    },
  ])('rejects unsupported or inconsistent versioned state %#', value => {
    expect(() => parseStateDocument(value)).toThrow(StateSchemaError)
  })
})
