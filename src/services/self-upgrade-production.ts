import type { RuntimeOutcome, RuntimePorts } from '../runtime'
import type {
  SelfUpgradeApplicationInput,
  SelfUpgradeApplicationOutcome,
  SelfUpgradeApplicationPorts,
} from '../self/application'
import { getCliContext, registerCliCancellationHandler } from '../cli-context'
import {
  createChildProcessPort,
  createFetchNetworkPort,
  createInvocationContext,
  createVersionCachePort,
} from '../runtime'
import * as selfModule from '../self'
import { runSelfUpgradeApplication } from '../self/application'
import { createSelfInstallSourcePersistencePort } from '../self/state-persistence'

export interface ProductionSelfUpgradeInvocation {
  dispose(): void
  run(input: SelfUpgradeApplicationInput): Promise<SelfUpgradeApplicationOutcome>
}

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

  const applicationPorts: SelfUpgradeApplicationPorts = {
    plan: input =>
      selfModule.planSelfUpgrade({
        context: input.context,
        metadataCache: input.metadataCache,
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
    run: input => runSelfUpgradeApplication(input, invocation, applicationPorts),
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
