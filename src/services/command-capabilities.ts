import type { CommandContract, CommandEffect, StableCommandName } from '../command-contract/registry'
import { getCommandContracts } from '../command-contract/registry'

export interface CommandCapabilitySnapshot {
  readonly effects: ReadonlySet<CommandEffect>
  readonly effectsByCommand: ReadonlyMap<StableCommandName, ReadonlySet<CommandEffect>>
  readonly flags: ReadonlySet<string>
  readonly flagsByCommand: ReadonlyMap<StableCommandName, ReadonlySet<string>>
}

export interface V1CommandCapabilities {
  readonly assumeYes: boolean
  readonly cacheBypass: boolean
  readonly cacheRefresh: boolean
  readonly channels: string[]
  readonly colorModes: string[]
  readonly dryRun: boolean
  readonly execInstallPolicies: string[]
  readonly freshnessMetadata: boolean
  readonly idempotencyKey: boolean
  readonly logLevels: string[]
  readonly quietLogs: boolean
  readonly selfUpgrade: boolean
  readonly timeout: boolean
}

export function getCommandCapabilitySnapshot(
  contracts: readonly CommandContract[] = getCommandContracts(),
): CommandCapabilitySnapshot {
  const effectsByCommand = new Map(contracts.map(contract => [contract.name, new Set(contract.effects)] as const))
  const flagsByCommand = new Map(contracts.map(contract => [contract.name, new Set(contract.flags)] as const))

  return {
    effects: new Set(contracts.flatMap(contract => contract.effects)),
    effectsByCommand,
    flags: new Set(contracts.flatMap(contract => contract.flags)),
    flagsByCommand,
  }
}

export function projectCommandCapabilitiesToV1Features(
  snapshot: CommandCapabilitySnapshot,
  options: { readonly canAutoUpdateSelf: boolean },
): V1CommandCapabilities {
  const upgradeEffects = snapshot.effectsByCommand.get('upgrade')
  const upgradeFlags = snapshot.flagsByCommand.get('upgrade')
  const execFlags = snapshot.flagsByCommand.get('exec')

  return {
    assumeYes: snapshot.flags.has('--yes'),
    cacheBypass: snapshot.flags.has('--no-cache'),
    cacheRefresh: snapshot.flags.has('--refresh'),
    channels: upgradeFlags?.has('--channel') ? ['stable', 'beta'] : [],
    colorModes: snapshot.flags.has('--color') ? ['auto', 'always', 'never'] : [],
    dryRun: snapshot.flags.has('--dry-run'),
    execInstallPolicies: execFlags?.has('--install') ? ['never', 'if-missing', 'always'] : [],
    freshnessMetadata:
      snapshot.effects.has('network') && snapshot.flags.has('--refresh') && snapshot.flags.has('--no-cache'),
    idempotencyKey: snapshot.flags.has('--idempotency-key'),
    logLevels: snapshot.flags.has('--log-level') ? ['silent', 'error', 'warn', 'info', 'debug'] : [],
    quietLogs: snapshot.flags.has('--quiet'),
    selfUpgrade: options.canAutoUpdateSelf && Boolean(upgradeEffects?.has('mutation') && upgradeEffects.has('network')),
    timeout: snapshot.flags.has('--timeout'),
  }
}
