import { readdir, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const deletedLifecycleBarrel = 'src/lifecycle/index.ts'

const coreInternalLifecycleModules = [
  'src/core/lifecycle/agent-execution.ts',
  'src/core/lifecycle/agent-observation.ts',
  'src/core/lifecycle/model.ts',
  'src/core/lifecycle/provider-binding.ts',
  'src/core/lifecycle/provider-evidence.ts',
  'src/core/lifecycle/uninstall-postcondition.ts',
  'src/core/lifecycle/update-planner.ts',
] as const

const coreInternalModel = 'src/core/lifecycle/model.ts'
const stateCoreLeafImport = "from '../core/lifecycle/model'"

describe('P8 lifecycle→Core closure', () => {
  it('keeps Core engines on Core-internal paths after barrel deletion', async () => {
    const execution = await source('src/core/execution-executor.ts')
    expect(execution).toContain("from './lifecycle/agent-execution'")
    expect(execution).toContain("from './lifecycle/agent-observation'")
    expect(execution).toContain('planAgentExecutionPreflight')
    expect(execution).toContain("from './lifecycle/model'")
    expect(execution).not.toContain("from '../lifecycle'")
    expect(execution).not.toContain('createQuantex')

    const observation = await source('src/core/production-observation.ts')
    expect(observation).toContain("from './lifecycle/agent-observation'")
    expect(observation).toContain('observeAgentLifecycle')
    expect(observation).toContain("from './lifecycle/provider-binding'")
    expect(observation).not.toContain("from '../lifecycle/agent-observation'")
    expect(observation).not.toContain("from '../lifecycle/provider-binding'")

    const updateProduction = await source('src/core/update-production.ts')
    expect(updateProduction).toContain("from './lifecycle/update-planner'")
    expect(updateProduction).toContain('planLifecycleUpdate')
    expect(updateProduction).toContain("from './lifecycle/agent-observation'")
    expect(updateProduction).toContain("from './lifecycle/provider-binding'")
    expect(updateProduction).not.toContain("from '../lifecycle'")
    expect(updateProduction).not.toContain("from '../lifecycle/agent-observation'")
    expect(updateProduction).not.toContain("from '../lifecycle/provider-binding'")

    const uninstall = await source('src/core/uninstall-executor.ts')
    expect(uninstall).toContain("from './lifecycle/uninstall-postcondition'")
    expect(uninstall).toContain('waitForUninstallAbsence')
    expect(uninstall).toContain('observeLifecycleProvider')
    expect(uninstall).toContain("from './lifecycle/model'")
    expect(uninstall).toContain("from './lifecycle/provider-binding'")
    expect(uninstall).toContain("from './lifecycle/provider-evidence'")
    expect(uninstall).not.toContain("from '../lifecycle/uninstall-postcondition'")
    expect(uninstall).not.toContain("from '../lifecycle/provider-binding'")
    expect(uninstall).not.toContain("from '../lifecycle/provider-evidence'")

    const planning = await source('src/planning/updates.ts')
    expect(planning).toContain("from '../core/lifecycle/update-planner'")
    expect(planning).toContain('planLifecycleUpdate')
    expect(planning).not.toContain("from '../lifecycle/update-planner'")
  })

  it('does not publish lifecycle engines on the Core SDK surface', async () => {
    const publicCore = await source('src/core/index.ts')
    expect(publicCore).not.toContain('observeAgentLifecycle')
    expect(publicCore).not.toContain('planLifecycleUpdate')
    expect(publicCore).not.toContain('waitForUninstallAbsence')
    expect(publicCore).not.toContain('planAgentExecutionPreflight')
    expect(publicCore).not.toContain('observeLifecycleProvider')
    expect(publicCore).not.toContain('LifecycleProviderBinding')
    expect(publicCore).not.toContain('resolveInstallMethodProviderBinding')
    expect(publicCore).not.toContain('../lifecycle')
    expect(publicCore).not.toContain('./lifecycle')
    expect(publicCore).not.toContain('LifecycleReceipt')
    expect(publicCore).not.toContain('LIFECYCLE_RECEIPT_SCHEMA_VERSION')

    const packageEntry = await source('packages/core/src/index.ts')
    expect(packageEntry).not.toContain('observeAgentLifecycle')
    expect(packageEntry).not.toContain('planLifecycleUpdate')
    expect(packageEntry).not.toContain('waitForUninstallAbsence')
    expect(packageEntry).not.toContain('planAgentExecutionPreflight')
    expect(packageEntry).not.toContain('observeLifecycleProvider')
    expect(packageEntry).not.toContain('LifecycleProviderBinding')
    expect(packageEntry).not.toContain('../lifecycle')
    expect(packageEntry).not.toContain('LifecycleReceipt')
    expect(packageEntry).not.toContain('LIFECYCLE_RECEIPT_SCHEMA_VERSION')
  })
})

describe('L1 lifecycle model Core-internal leaf', () => {
  it('owns receipt types in src/core/lifecycle/model without Core runtime imports', async () => {
    const model = await source(coreInternalModel)
    expect(model).toContain('export interface LifecycleReceipt')
    expect(model).toContain('export const LIFECYCLE_RECEIPT_SCHEMA_VERSION')
    expect(model).not.toMatch(/\bfrom ['"]/u)
  })

  it('lets state import only the Core-internal leaf, not Core runtime', async () => {
    const stateFiles = ['src/state/schema.ts', 'src/state/store.ts', 'src/state/index.ts'] as const
    for (const path of stateFiles) {
      const text = await source(path)
      expect(text).toContain(stateCoreLeafImport)
      expect(text).not.toContain("from '../lifecycle/model'")
      expect(text).not.toContain('provider-binding')
      expect(text).not.toContain('provider-evidence')
      expect(text).not.toContain('agent-observation')
      expect(text).not.toContain('update-planner')
      expect(text).not.toContain('agent-execution')
      expect(text).not.toContain('uninstall-postcondition')
      const coreImports = [...text.matchAll(/from ['"](\.\.\/core[^'"]*)['"]/gu)].map(match => match[1])
      expect(coreImports).toEqual(['../core/lifecycle/model'])
      expect(text).not.toContain('createQuantex')
      expect(text).not.toContain('../core/index')
    }

    const schema = await source('src/state/schema.ts')
    expect(schema).toContain('export { LIFECYCLE_RECEIPT_SCHEMA_VERSION }')
  })

  it('retargets former lifecycle/model importers onto the Core-internal leaf', async () => {
    const installation = await source('src/core/installation-production.ts')
    expect(installation).toContain("from './lifecycle/model'")
    expect(installation).not.toContain("from '../lifecycle/model'")

    const stateRecord = await source('src/core/installation-state-record.ts')
    expect(stateRecord).toContain("from './lifecycle/model'")

    const packageManager = await source('src/package-manager/index.ts')
    expect(packageManager).toContain("from '../core/lifecycle/model'")
    expect(packageManager).not.toContain("from '../lifecycle/model'")

    const binding = await source('src/core/lifecycle/provider-binding.ts')
    expect(binding).toContain("from './model'")
    expect(binding).not.toContain("from '../lifecycle/model'")

    const observation = await source('src/core/lifecycle/agent-observation.ts')
    expect(observation).toContain("from './model'")
    expect(observation).not.toContain("from '../lifecycle/model'")

    const planner = await source('src/core/lifecycle/update-planner.ts')
    expect(planner).toContain("from './model'")

    const execution = await source('src/core/lifecycle/agent-execution.ts')
    expect(execution).toContain("from './model'")
  })
})

describe('L2 lifecycle provider-binding Core-internal modules', () => {
  it('owns binding and evidence under src/core/lifecycle without a Core lifecycle barrel', async () => {
    for (const path of coreInternalLifecycleModules) await source(path)

    await expect(source('src/lifecycle/provider-binding.ts')).rejects.toThrow()
    await expect(source('src/lifecycle/provider-evidence.ts')).rejects.toThrow()
    await expect(source('src/lifecycle/model.ts')).rejects.toThrow()
    await expect(source('src/lifecycle/shadow-planning.ts')).rejects.toThrow()
    await expect(source('src/core/lifecycle/index.ts')).rejects.toThrow()

    const binding = await source('src/core/lifecycle/provider-binding.ts')
    expect(binding).toContain('export interface LifecycleProviderBinding')
    expect(binding).toContain('resolveInstallMethodProviderBinding')
    expect(binding).not.toContain('../lifecycle')
    expect(binding).not.toContain('createQuantex')

    const evidence = await source('src/core/lifecycle/provider-evidence.ts')
    expect(evidence).toContain('observeLifecycleProvider')
    expect(evidence).toContain('firstPartyProviderRegistry')
    expect(evidence).toContain("from './provider-binding'")
    expect(evidence).not.toContain('../lifecycle')
    expect(evidence).not.toContain('createQuantex')
  })

  it('retargets former lifecycle/provider-binding importers onto Core-internal modules', async () => {
    const installation = await source('src/core/installation-executor.ts')
    expect(installation).toContain("from './lifecycle/provider-binding'")
    expect(installation).not.toContain("from '../lifecycle/provider-binding'")

    const recipe = await source('src/core/installation-recipe-resolver.ts')
    expect(recipe).toContain("from './lifecycle/provider-binding'")

    const client = await source('src/core/client.ts')
    expect(client).toContain("from './lifecycle/provider-binding'")
    expect(client).not.toContain('provider-evidence')

    const cli = await source('src/commands/core-installation-cli.ts')
    expect(cli).toContain("from '../core/lifecycle/provider-binding'")
    expect(cli).not.toContain("from '../lifecycle/provider-binding'")
  })
})

describe('L3 lifecycle engines Core-internal modules', () => {
  it('owns observation, planner, execution, and postcondition under src/core/lifecycle', async () => {
    for (const path of coreInternalLifecycleModules) await source(path)

    await expect(source('src/lifecycle/agent-observation.ts')).rejects.toThrow()
    await expect(source('src/lifecycle/update-planner.ts')).rejects.toThrow()
    await expect(source('src/lifecycle/agent-execution.ts')).rejects.toThrow()
    await expect(source('src/lifecycle/uninstall-postcondition.ts')).rejects.toThrow()
    await expect(source('src/core/lifecycle/index.ts')).rejects.toThrow()

    const coreLifecycleEntries = await readdir(new URL('../../src/core/lifecycle', import.meta.url))
    expect(coreLifecycleEntries.filter(name => name.endsWith('.ts')).sort()).toEqual([
      'agent-execution.ts',
      'agent-observation.ts',
      'model.ts',
      'provider-binding.ts',
      'provider-evidence.ts',
      'uninstall-postcondition.ts',
      'update-planner.ts',
    ])
  })

  it('forbids state and Core-internal engines from depending on Core runtime', async () => {
    for (const path of coreInternalLifecycleModules) {
      const text = await source(path)
      expect(text).not.toContain("from '../../core/index'")
      expect(text).not.toContain("from '../index'")
      expect(text).not.toContain('createQuantex')
      expect(text).not.toContain('../installation-')
      expect(text).not.toContain('../uninstall-executor')
      expect(text).not.toContain('../update-executor')
      expect(text).not.toContain('../execution-executor')
    }

    const observation = await source('src/core/lifecycle/agent-observation.ts')
    expect(observation).toContain("from './provider-binding'")
    expect(observation).toContain('observeAgentLifecycle')
    expect(observation).not.toContain('../lifecycle')

    const planner = await source('src/core/lifecycle/update-planner.ts')
    expect(planner).toContain('planLifecycleUpdate')
    expect(planner).not.toContain('../lifecycle')

    const execution = await source('src/core/lifecycle/agent-execution.ts')
    expect(execution).toContain('planAgentExecutionPreflight')
    expect(execution).toContain("from './agent-observation'")

    const postcondition = await source('src/core/lifecycle/uninstall-postcondition.ts')
    expect(postcondition).toContain('waitForUninstallAbsence')
    expect(postcondition).not.toContain('../lifecycle')
  })

  it('retargets Core, services, and planning onto Core-internal engines', async () => {
    const services = await source('src/services/lifecycle-observations.ts')
    expect(services).toContain("from '../core/lifecycle/agent-observation'")
    expect(services).toContain('observeAgentLifecycle')
    expect(services).not.toContain("from '../lifecycle/agent-observation'")

    const updates = await source('src/services/lifecycle-updates-production.ts')
    expect(updates).toContain("from '../core/lifecycle/update-planner'")
    expect(updates).not.toContain("from '../lifecycle'")

    const updateExecutor = await source('src/core/update-executor.ts')
    expect(updateExecutor).toContain("from './lifecycle/update-planner'")
    expect(updateExecutor).not.toContain("from '../lifecycle'")
  })
})

describe('L5 leftover scan after lifecycle barrel deletion', () => {
  const leftoverKeepHang = 'L5 leftover scan: KEEP product-path hang here (do not restore src/lifecycle).'

  it('does not restore src/lifecycle and keeps Core-internal modules barrel-free', async () => {
    await expect(source(deletedLifecycleBarrel)).rejects.toThrow()
    await expect(readdir(new URL('../../src/lifecycle', import.meta.url))).rejects.toThrow()
    await expect(source('src/core/lifecycle/index.ts')).rejects.toThrow()

    for (const path of coreInternalLifecycleModules) {
      const text = await source(path)
      expect(text).toContain(leftoverKeepHang)
    }
  })

  it('keeps already-deleted leftover shells absent', async () => {
    await expect(source('src/self/application.ts')).rejects.toThrow()
    await expect(source('src/core/self-upgrade-production.ts')).rejects.toThrow()
    await expect(source('src/services/self-upgrade.ts')).rejects.toThrow()
    await expect(source('src/services/lifecycle-updates.ts')).rejects.toThrow()
    await expect(source('src/services/lifecycle-execution.ts')).rejects.toThrow()
  })

  it('keeps differential CLI/self/idempotency/compatibility layers after the L5 scan', async () => {
    const servicesBarrel = await source('src/services/index.ts')
    expect(servicesBarrel).toContain("from './agents'")
    expect(servicesBarrel).toContain("from './update'")
    expect(servicesBarrel).not.toMatch(/from ['"]\.\/self-upgrade-production['"]/u)
    expect(servicesBarrel).not.toMatch(/from ['"]\.\/lifecycle-execution-production['"]/u)
    expect(servicesBarrel).not.toMatch(/from ['"]\.\/lifecycle-updates-production['"]/u)
    expect(servicesBarrel).toContain('KEEP (P5 / P7 / L5)')

    const compatibility = await source('src/compatibility/index.ts')
    expect(compatibility).toContain("from '../services'")
    expect(compatibility).toContain("from '../self'")
    expect(compatibility).toContain('KEEP (L5): published v1 root facade')

    const inspectionProjector = await source('src/compatibility/agent-inspection.ts')
    expect(inspectionProjector).toContain('projectObservationToV1Inspection')
    expect(inspectionProjector).toContain('formatInstalledSource')
    expect(inspectionProjector).toContain('KEEP (L5): v1 inspection projector')

    const selfBarrel = await source('src/self/index.ts')
    expect(selfBarrel).toContain('planSelfUpgrade')
    expect(selfBarrel).toContain('upgradeSelf')
    expect(selfBarrel).toContain('acquireSelfUpgradeLock')
    expect(selfBarrel).toContain('KEEP (P7 / L5)')

    const selfPlanning = await source('src/self/planning.ts')
    expect(selfPlanning).toContain('planSelfUpgrade')
    expect(selfPlanning).toContain('KEEP (P7 / L5)')

    const policy = await source('src/idempotency/lifecycle-policy.ts')
    expect(policy).toContain("from '../core/lifecycle/model'")
    expect(policy).toContain("from '../core/lifecycle/provider-binding'")
    expect(policy).toContain("from '../core/lifecycle/provider-evidence'")
    expect(policy).toContain('observeLifecycleProvider')
    expect(policy).not.toContain("from '../lifecycle'")
    expect(policy).toContain('KEEP (L5): idempotency policy is differential')

    const upgradeProduction = await source('src/services/self-upgrade-production.ts')
    expect(upgradeProduction).toContain('getCliContext')
    expect(upgradeProduction).toContain('executeCoreSelfUpgrade')
    expect(upgradeProduction).toContain('KEEP (P6 / P7 / L5)')

    const executionProduction = await source('src/services/lifecycle-execution-production.ts')
    expect(executionProduction).toContain('executeAgentLifecycle')
    expect(executionProduction).toContain("stdio: options.outputMode === 'human'")
    expect(executionProduction).toContain('KEEP (P2 / L5)')

    const updateProduction = await source('src/services/lifecycle-updates-production.ts')
    expect(updateProduction).toContain('createCoreSingleAgentUpdateInvocation')
    expect(updateProduction).toContain('KEEP (P2 / L5)')

    const doctorProduction = await source('src/services/doctor-diagnosis-production.ts')
    expect(doctorProduction).toContain('diagnoseDoctorEnvironment')
    expect(doctorProduction).toContain('KEEP (P2 / L5)')
  })

  it('finds production importers for every leftover-scan candidate module', async () => {
    const candidates: ReadonlyArray<{ path: string; importer: string; token: string }> = [
      { path: 'src/services/index.ts', importer: 'src/compatibility/index.ts', token: "from '../services'" },
      { path: 'src/services/agents.ts', importer: 'src/services/index.ts', token: "from './agents'" },
      { path: 'src/services/update.ts', importer: 'src/services/index.ts', token: "from './update'" },
      {
        path: 'src/services/self-upgrade-production.ts',
        importer: 'src/commands/upgrade.ts',
        token: "from '../services/self-upgrade-production'",
      },
      {
        path: 'src/services/lifecycle-execution-production.ts',
        importer: 'src/commands/run.ts',
        token: "from '../services/lifecycle-execution-production'",
      },
      {
        path: 'src/services/lifecycle-updates-production.ts',
        importer: 'src/commands/update.ts',
        token: "from '../services/lifecycle-updates-production'",
      },
      {
        path: 'src/services/doctor-diagnosis-production.ts',
        importer: 'src/commands/doctor.ts',
        token: "from '../services/doctor-diagnosis-production'",
      },
      {
        path: 'src/services/lifecycle-observations.ts',
        importer: 'src/services/lifecycle-execution-production.ts',
        token: "from './lifecycle-observations'",
      },
      {
        path: 'src/services/core-read-observations.ts',
        importer: 'src/commands/inspect.ts',
        token: "from '../services/core-read-observations'",
      },
      {
        path: 'src/services/provider-observations.ts',
        importer: 'src/commands/capabilities.ts',
        token: "from '../services/provider-observations'",
      },
      {
        path: 'src/services/command-capabilities.ts',
        importer: 'src/commands/capabilities.ts',
        token: "from '../services/command-capabilities'",
      },
      { path: 'src/compatibility/index.ts', importer: 'src/index.ts', token: "from './compatibility'" },
      {
        path: 'src/compatibility/agent-inspection.ts',
        importer: 'src/commands/list.ts',
        token: "from '../compatibility/agent-inspection'",
      },
      { path: 'src/self/index.ts', importer: 'src/commands/upgrade.ts', token: "from '../self'" },
      { path: 'src/self/planning.ts', importer: 'src/self/index.ts', token: "from './planning'" },
      { path: 'src/self/lock.ts', importer: 'src/self/index.ts', token: "from './lock'" },
      { path: 'src/self/facts.ts', importer: 'src/self/index.ts', token: "from './facts'" },
      { path: 'src/self/binary.ts', importer: 'src/self/providers/binary.ts', token: "from '../binary'" },
      { path: 'src/self/providers/index.ts', importer: 'src/self/index.ts', token: "from './providers'" },
      { path: 'src/idempotency.ts', importer: 'src/command-runtime.ts', token: "from './idempotency'" },
      {
        path: 'src/idempotency/lifecycle-policy.ts',
        importer: 'src/commands/update.ts',
        token: "from '../idempotency/lifecycle-policy'",
      },
      { path: 'src/idempotency/canonical.ts', importer: 'src/idempotency/schema.ts', token: "from './canonical'" },
      { path: 'src/idempotency/replay.ts', importer: 'src/command-runtime.ts', token: "from './idempotency/replay'" },
      { path: 'src/idempotency/schema.ts', importer: 'src/idempotency.ts', token: "from './idempotency/schema'" },
    ]

    for (const candidate of candidates) {
      await source(candidate.path)
      const importer = await source(candidate.importer)
      expect(importer, `${candidate.importer} must import ${candidate.path}`).toContain(candidate.token)
    }
  })

  it('does not publish leftover engine or route identifiers on Core SDK or CLI JSON helpers', async () => {
    const publicCore = await source('src/core/index.ts')
    expect(publicCore).not.toContain('./lifecycle')
    expect(publicCore).not.toContain('engine')
    expect(publicCore).not.toContain('route')

    const packageEntry = await source('packages/core/src/index.ts')
    expect(packageEntry).not.toContain('lifecycle')
    expect(packageEntry).not.toContain('engine')
    expect(packageEntry).not.toContain('route')
  })
})

describe('L4 leftover lifecycle barrel deletion', () => {
  it('deletes src/lifecycle and keeps Core-internal modules barrel-free', async () => {
    await expect(source(deletedLifecycleBarrel)).rejects.toThrow()
    await expect(source('src/lifecycle/model.ts')).rejects.toThrow()
    await expect(source('src/lifecycle/provider-binding.ts')).rejects.toThrow()
    await expect(source('src/lifecycle/provider-evidence.ts')).rejects.toThrow()
    await expect(source('src/lifecycle/agent-observation.ts')).rejects.toThrow()
    await expect(source('src/lifecycle/update-planner.ts')).rejects.toThrow()
    await expect(source('src/lifecycle/agent-execution.ts')).rejects.toThrow()
    await expect(source('src/lifecycle/uninstall-postcondition.ts')).rejects.toThrow()
    await expect(source('src/core/lifecycle/index.ts')).rejects.toThrow()
    await expect(readdir(new URL('../../src/lifecycle', import.meta.url))).rejects.toThrow()

    const coreLifecycleEntries = await readdir(new URL('../../src/core/lifecycle', import.meta.url))
    expect(coreLifecycleEntries.filter(name => name.endsWith('.ts')).sort()).toEqual([
      'agent-execution.ts',
      'agent-observation.ts',
      'model.ts',
      'provider-binding.ts',
      'provider-evidence.ts',
      'uninstall-postcondition.ts',
      'update-planner.ts',
    ])
  })

  it('retargets remaining barrel callers onto Core-internal modules', async () => {
    const executionProduction = await source('src/services/lifecycle-execution-production.ts')
    expect(executionProduction).toContain("from '../core/lifecycle/model'")
    expect(executionProduction).toContain('LifecycleOutcome')
    expect(executionProduction).not.toContain("from '../lifecycle'")

    const policy = await source('src/idempotency/lifecycle-policy.ts')
    expect(policy).toContain("from '../core/lifecycle/model'")
    expect(policy).toContain("from '../core/lifecycle/provider-binding'")
    expect(policy).toContain("from '../core/lifecycle/provider-evidence'")
    expect(policy).toContain('observeLifecycleProvider')
    expect(policy).not.toContain("from '../lifecycle'")

    const relatedTests = [
      'test/commands/inspect.test.ts',
      'test/commands/doctor.test.ts',
      'test/commands/resolve.test.ts',
      'test/command-runtime.test.ts',
      'test/compatibility/agent-inspection.test.ts',
      'test/idempotency/lifecycle-policy.test.ts',
      'test/services/lifecycle-observations.test.ts',
      'test/services/lifecycle-updates.test.ts',
      'test/lifecycle/update-planner.test.ts',
      'test/lifecycle/provider-evidence.test.ts',
      'test/lifecycle/provider-binding.test.ts',
      'test/lifecycle/agent-observation.test.ts',
      'test/lifecycle/lifecycle-receipt-contract.test.ts',
    ] as const
    for (const path of relatedTests) {
      const text = await source(path)
      expect(text).not.toContain("from '../../src/lifecycle'")
      expect(text).not.toContain("from '../src/lifecycle'")
    }
  })
})

async function source(path: string): Promise<string> {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
}
