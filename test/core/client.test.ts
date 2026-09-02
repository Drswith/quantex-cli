import type { AgentDefinition } from '../../src/agents/types'
import type { CoreAgentObservation, CoreReadPorts } from '../../src/core/production-observation'
import type { AgentDescriptor, AgentInspection, CoreResult, Quantex } from '../../src/core/types'
import type { LifecycleObservation } from '../../src/lifecycle/model'
import type { LifecycleProviderBinding } from '../../src/lifecycle/provider-evidence'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { createQuantexClient } from '../../src/core/client'

const agent: AgentDefinition = {
  binaryName: 'fixture-agent',
  displayName: 'Fixture Agent',
  homepage: 'https://example.com/fixture-agent',
  lookupAliases: ['fixture'],
  name: 'fixture-agent',
  platforms: {
    linux: [{ packageName: '@fixture/agent', type: 'npm' }],
    macos: [{ packageName: '@fixture/agent', type: 'npm' }],
  },
}

const npmBinding: LifecycleProviderBinding = {
  providerId: 'npm',
  target: { id: '@fixture/agent', kind: 'package' },
}

type ObservationInput = LifecycleObservation extends infer Observation
  ? Observation extends LifecycleObservation
    ? Omit<Observation, 'observedAt' | 'targetId'>
    : never
  : never

describe('Core read client', () => {
  it('exposes an instance client with minimal typed list and inspect results', async () => {
    const client = createQuantexClient({ configDir: '/isolated/quantex' }, createPorts(managedObservation()))
    const listed = await client.list()
    const inspected = await client.inspect('fixture-agent')

    expectTypeOf(client).toEqualTypeOf<Quantex>()
    expectTypeOf(listed).toEqualTypeOf<CoreResult<readonly AgentDescriptor[]>>()
    expectTypeOf(inspected).toEqualTypeOf<CoreResult<AgentInspection>>()
    expect(listed).toEqual({
      ok: true,
      value: [
        {
          aliases: ['fixture'],
          binaryName: 'fixture-agent',
          displayName: 'Fixture Agent',
          homepage: 'https://example.com/fixture-agent',
          name: 'fixture-agent',
          platforms: ['linux', 'macos'],
        },
      ],
    })
    expect(inspected).toEqual({
      ok: true,
      value: {
        agent: listed.ok ? listed.value[0] : undefined,
        executablePath: '/resolved/fixture-agent',
        observedAt: '2026-07-22T00:00:00.000Z',
        source: {
          provider: 'npm',
          target: '@fixture/agent',
          targetKind: 'package',
        },
        status: 'managed',
        version: '1.2.3',
      },
    })
    expect(Object.isFrozen(client)).toBe(true)
    expect(listed.ok && Object.isFrozen(listed.value)).toBe(true)
  })

  it.each([
    {
      expected: { status: 'missing' },
      label: 'missing',
      observation: createObservation({ drift: { kind: 'none' }, kind: 'absent' }),
    },
    {
      expected: {
        detectedSource: { provider: 'npm', target: '@fixture/agent', targetKind: 'package' },
        status: 'external',
      },
      label: 'external',
      observation: createObservation(
        {
          drift: { kind: 'untracked' },
          executablePath: '/bin/fixture-agent',
          kind: 'present',
          providerId: 'npm',
          providerTargetId: '@fixture/agent',
          providerTargetKind: 'package',
          version: '1.2.3',
        },
        { binding: npmBinding },
      ),
    },
    {
      expected: {
        recordedSource: { provider: 'npm', target: '@fixture/agent', targetKind: 'package' },
        status: 'stale',
      },
      label: 'stale',
      observation: createObservation(
        { drift: { kind: 'recorded-absent' }, kind: 'absent' },
        { persistedBinding: npmBinding },
      ),
    },
    {
      expected: {
        detectedSource: { provider: 'npm', target: '@fixture/agent', targetKind: 'package' },
        recordedSource: { provider: 'npm', target: '@fixture/agent', targetKind: 'package' },
        status: 'conflict',
      },
      label: 'conflict',
      observation: createObservation(
        {
          drift: { kind: 'conflicting-source', observedProviderId: 'npm', recordedProviderId: 'bun' },
          executablePath: '/bin/fixture-agent',
          kind: 'present',
          version: '1.2.3',
        },
        { binding: npmBinding, persistedBinding: npmBinding },
      ),
    },
    {
      expected: {
        detectedSource: { provider: 'npm', target: '@fixture/agent', targetKind: 'package' },
        executablePath: '/resolved/fixture-agent',
        reason: 'provider presence is unknown',
        recordedSource: { provider: 'npm', target: '@fixture/agent', targetKind: 'package' },
        status: 'indeterminate',
        version: '1.2.3',
      },
      label: 'indeterminate',
      observation: createObservation(
        {
          drift: { kind: 'indeterminate', reason: 'provider presence is unknown' },
          kind: 'indeterminate',
          reason: 'provider presence is unknown',
        },
        {
          binding: npmBinding,
          executable: { path: '/bin/fixture-agent', present: true, version: '1.2.3' },
          persistedBinding: npmBinding,
          resolvedBinaryPath: '/resolved/fixture-agent',
        },
      ),
    },
  ])('projects canonical $label evidence without contradictory ownership', async ({ expected, observation: value }) => {
    const result = await createQuantexClient({}, createPorts(value)).inspect('fixture-agent')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject(expected)
  })

  it('keeps unknown agents as an expected machine-usable failure', async () => {
    const ports = createPorts(undefined)
    const result = await createQuantexClient({}, ports).inspect('unknown')

    expect(result).toEqual({
      error: {
        code: 'agent-not-found',
        details: { name: 'unknown' },
        message: 'Unknown agent: unknown',
        remediation: 'Use list() to discover registered agent names and aliases.',
        retryable: false,
      },
      ok: false,
    })
  })

  it('fails closed on corrupt state without projecting it as missing', async () => {
    const error = new Error('unsupported schemaVersion "3".')
    error.name = 'StateSchemaError'
    const ports = createPorts(managedObservation())
    ports.inspectAgent = vi.fn(async () => Promise.reject(error))

    const result = await createQuantexClient({}, ports).inspect('fixture-agent')

    expect(result).toEqual({
      error: {
        code: 'invalid-state',
        message: 'Quantex state could not be read safely: unsupported schemaVersion "3".',
        remediation: 'Repair or restore state.json before retrying; Core did not replace it.',
        retryable: false,
      },
      ok: false,
    })
  })

  it('rejects invalid timeouts without invoking a read port', async () => {
    const ports = createPorts(managedObservation())
    const result = await createQuantexClient({}, ports).inspect('fixture-agent', { timeoutMs: 0 })

    expect(result).toEqual({
      error: {
        code: 'invalid-request',
        message: 'timeoutMs must be a positive integer.',
        retryable: false,
      },
      ok: false,
    })
    expect(ports.inspectAgent).not.toHaveBeenCalled()
  })

  it('does not print or write process output for expected results', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const client = createQuantexClient({}, createPorts(managedObservation()))
      await client.list()
      await client.inspect('fixture-agent')
      await client.inspect('unknown')

      expect(log).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
      expect(stdout).not.toHaveBeenCalled()
      expect(stderr).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
      error.mockRestore()
      stdout.mockRestore()
      stderr.mockRestore()
    }
  })
})

function createPorts(inspected: CoreAgentObservation | undefined): CoreReadPorts {
  return {
    inspectAgent: vi.fn(async () => inspected),
    listAgents: vi.fn(async () => [agent]),
  }
}

function managedObservation(): CoreAgentObservation {
  return createObservation(
    {
      drift: { kind: 'none' },
      executablePath: '/bin/fixture-agent',
      kind: 'present',
      providerId: 'npm',
      providerTargetId: '@fixture/agent',
      providerTargetKind: 'package',
      version: '1.2.3',
    },
    {
      binding: npmBinding,
      persistedBinding: npmBinding,
      resolvedBinaryPath: '/resolved/fixture-agent',
    },
  )
}

function createObservation(
  lifecycleObservation: ObservationInput,
  overrides: Partial<CoreAgentObservation> = {},
): CoreAgentObservation {
  const pathExecutable =
    lifecycleObservation.kind === 'present'
      ? {
          path: lifecycleObservation.executablePath,
          present: true,
          version: lifecycleObservation.version,
        }
      : { present: false }

  return {
    agent,
    capabilities: [],
    catalogMethods: [],
    executable: pathExecutable,
    methods: [],
    observation: {
      ...lifecycleObservation,
      observedAt: '2026-07-22T00:00:00.000Z',
      targetId: agent.name,
    } as LifecycleObservation,
    pathExecutable,
    ...overrides,
  }
}
