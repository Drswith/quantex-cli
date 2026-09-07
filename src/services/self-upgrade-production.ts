import type { CoreSelfUpgradeInput, CoreSelfUpgradeOutcome, CoreSelfUpgradePorts } from '../core/self-upgrade-executor'
import type { RuntimeOutcome, RuntimePorts } from '../runtime'
import type { SelfUpdateResult, SelfUpgradePlan } from '../self'
import { getCliContext, registerCliCancellationHandler } from '../cli-context'
import { executeCoreSelfUpgrade } from '../core/self-upgrade-executor'
import {
  createChildProcessPort,
  createFetchNetworkPort,
  createInvocationContext,
  createVersionCachePort,
} from '../runtime'
import * as selfModule from '../self'
import { createSelfInstallSourcePersistencePort } from '../self/state-persistence'

export interface ProductionSelfUpgradeInvocation {
  dispose(): void
  run(input: CoreSelfUpgradeInput): Promise<CoreSelfUpgradeOutcome<SelfUpgradePlan, SelfUpdateResult>>
}

/**
 * KEEP (P6 / P7 / L5): CLI production bridge over the in-repo Core self-upgrade executor.
 * Importers: src/commands/upgrade.ts.
 * Owns CLI cancellation/invocation context and src/self domain port binding.
 * Core owns plan/check/apply orchestration and must stay free of src/self.
 * L5 leftover scan: not zero-ref and not a pure pass-through.
 */
export function createProductionSelfUpgradeInvocation(): ProductionSelfUpgradeInvocation {
  const cliContext = getCliContext()
  const invocation = createInvocationContext({
    cacheMode: cliContext.cacheMode,
    dryRun: cliContext.dryRun,
    outputMode: cliContext.outputMode,
    ports: createSelfUpgradeRuntimePorts(),
    quiet: cliContext.quiet,
    timeoutMs: cliContext.timeoutMs,
  })
  if (cliContext.cancelled) void invocation.cancel('cancelled')
  const unregister = registerCliCancellationHandler(() => invocation.cancel('cancelled'))
  let disposed = false

  const ports: CoreSelfUpgradePorts<SelfUpgradePlan, SelfUpdateResult> = {
    plan: input =>
      selfModule.planSelfUpgrade({
        context: input.context,
        metadataCache: input.metadataCache,
        metadataCacheMode: input.metadataCacheMode,
        networkPort: input.networkPort,
        persistencePort: input.persistencePort,
        updateChannel: input.updateChannel,
      }),
    upgrade: (plan, input) => selfModule.upgradeSelf(plan, input),
  }

  return {
    dispose(): void {
      if (disposed) return
      disposed = true
      unregister()
    },
    run: input => executeCoreSelfUpgrade(input, invocation, ports),
  }
}

function createSelfUpgradeRuntimePorts(): RuntimePorts {
  return {
    cache: createVersionCachePort(),
    clock: { now: Date.now, sleep: unavailable },
    fileSystem: {
      makeDirectory: unavailable,
      readFile: unavailable,
      remove: unavailable,
      rename: unavailable,
      writeFile: unavailable,
    },
    locks: selfModule.createSelfUpgradeLockPort(),
    network: createFetchNetworkPort(),
    persistence: createSelfInstallSourcePersistencePort(),
    process: createChildProcessPort(),
  }
}

async function unavailable(): Promise<RuntimeOutcome<never>> {
  return {
    error: { kind: 'unavailable', message: 'Runtime port is not bound for this self-upgrade operation.' },
    kind: 'failure',
  }
}
