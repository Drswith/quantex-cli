import type { ProviderRegistry } from '../../src/providers/registry'
import type { ProviderTargetRequest } from '../../src/providers/types'
import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { runCoreInvocation } from '../../src/core/invocation'
import { createProductionCoreReadPorts } from '../../src/core/production-observation'
import { createEmptyStateDocument } from '../../src/state/schema'

describe('production Core observation', () => {
  it.skipIf(process.platform === 'win32')('reads an installed version emitted on stderr', async () => {
    const root = await mkdtemp(join(tmpdir(), 'quantex-core-version-stderr-'))
    const binDir = join(root, 'bin')
    const target = join(root, 'pi-target')
    const configDir = join(root, 'config')
    const previousPath = process.env.PATH

    try {
      await mkdir(binDir, { recursive: true })
      await mkdir(configDir, { recursive: true })
      await writeFile(target, '#!/bin/sh\necho 0.73.1 >&2\n')
      await chmod(target, 0o755)
      await symlink(target, join(binDir, 'pi'))
      process.env.PATH = `${binDir}:${previousPath ?? ''}`

      const ports = createProductionCoreReadPorts({ providerRegistry: bunRegistry(undefined) })
      const outcome = await runCoreInvocation(undefined, context => ports.inspectAgent('pi', { ...context, configDir }))

      expect(outcome).toMatchObject({
        kind: 'success',
        value: {
          executable: { present: true, version: '0.73.1' },
          pathExecutable: { present: true, version: '0.73.1' },
        },
      })
    } finally {
      process.env.PATH = previousPath
      await rm(root, { force: true, recursive: true })
    }
  })

  it.skipIf(process.platform === 'win32')(
    'canonicalizes a PATH symlink before comparing it with a recorded executable path',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'quantex-core-observation-'))
      const binDir = join(root, 'bin')
      const target = join(root, 'pi-target')
      const configDir = join(root, 'config')
      const previousPath = process.env.PATH

      try {
        await mkdir(binDir, { recursive: true })
        await mkdir(configDir, { recursive: true })
        await writeFile(target, '#!/bin/sh\necho 0.73.1\n')
        await chmod(target, 0o755)
        await symlink(target, join(binDir, 'pi'))
        const canonicalTarget = await realpath(target)

        const state = createEmptyStateDocument()
        state.installedAgents.pi = {
          agentName: 'pi',
          installType: 'bun',
          packageName: '@mariozechner/pi-coding-agent',
        }
        state.lifecycleReceipts.pi = {
          executablePath: canonicalTarget,
          kind: 'lifecycle-receipt',
          providerId: 'bun',
          providerTargetId: '@mariozechner/pi-coding-agent',
          providerTargetKind: 'package',
          schemaVersion: 1,
          targetId: 'pi',
          verifiedAt: '2026-07-31T00:00:00.000Z',
          version: '0.73.1',
        }
        await writeFile(join(configDir, 'state.json'), JSON.stringify(state))
        process.env.PATH = `${binDir}:${previousPath ?? ''}`

        const ports = createProductionCoreReadPorts({ providerRegistry: bunRegistry() })
        const outcome = await runCoreInvocation(undefined, context =>
          ports.inspectAgent('pi', { ...context, configDir }),
        )

        expect(outcome).toMatchObject({
          kind: 'success',
          value: {
            executable: { path: canonicalTarget, present: true, version: '0.73.1' },
            observation: { drift: { kind: 'none' }, executablePath: canonicalTarget, kind: 'present' },
            resolvedBinaryPath: canonicalTarget,
          },
        })
      } finally {
        process.env.PATH = previousPath
        await rm(root, { force: true, recursive: true })
      }
    },
  )

  it.skipIf(process.platform === 'win32')(
    'uses stderr when the PATH executable emits its version only on stderr',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'quantex-core-observation-'))
      const binDir = join(root, 'bin')
      const target = join(root, 'pi-target')
      const configDir = join(root, 'config')
      const previousPath = process.env.PATH

      try {
        await mkdir(binDir, { recursive: true })
        await mkdir(configDir, { recursive: true })
        await writeFile(target, '#!/bin/sh\nprintf "%s\\n" 0.73.1 >&2\n')
        await chmod(target, 0o755)
        await symlink(target, join(binDir, 'pi'))

        const state = createEmptyStateDocument()
        state.installedAgents.pi = {
          agentName: 'pi',
          installType: 'bun',
          packageName: '@mariozechner/pi-coding-agent',
        }
        state.lifecycleReceipts.pi = {
          executablePath: await realpath(target),
          kind: 'lifecycle-receipt',
          providerId: 'bun',
          providerTargetId: '@mariozechner/pi-coding-agent',
          providerTargetKind: 'package',
          schemaVersion: 1,
          targetId: 'pi',
          verifiedAt: '2026-07-31T00:00:00.000Z',
          version: '0.73.1',
        }
        await writeFile(join(configDir, 'state.json'), JSON.stringify(state))
        process.env.PATH = `${binDir}:${previousPath ?? ''}`

        const ports = createProductionCoreReadPorts({ providerRegistry: bunRegistry() })
        const outcome = await runCoreInvocation(undefined, context =>
          ports.inspectAgent('pi', { ...context, configDir }),
        )

        expect(outcome).toMatchObject({
          kind: 'success',
          value: {
            pathExecutable: { present: true, version: '0.73.1' },
          },
        })
      } finally {
        process.env.PATH = previousPath
        await rm(root, { force: true, recursive: true })
      }
    },
  )
})

function bunRegistry(version: string | undefined = '0.73.1'): ProviderRegistry {
  const adapter = {
    async availability() {
      return { kind: 'success' as const, value: { executable: 'bun' } }
    },
    id: 'bun' as const,
    async observe(request: ProviderTargetRequest) {
      return {
        kind: 'success' as const,
        value: {
          evidence: [],
          kind: 'present' as const,
          target: request.target,
          ...(version ? { version } : {}),
        },
      }
    },
  }
  return {
    get: id => (id === 'bun' ? adapter : undefined),
    getCapabilities: id => (id === 'bun' ? ['availability', 'observe'] : []),
    list: () => [adapter],
  }
}
