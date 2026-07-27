import type { Platform } from '../agents/types'
import type { ProviderRegistry } from '../providers/registry'
import type {
  ProviderAdapter,
  ProviderEvidence,
  ProviderExecutionEffect,
  ProviderId,
  ProviderMutationEvidence,
  ProviderOperationContext,
  ProviderOutcome,
  ProviderTarget,
  ProviderTargetRequest,
  ProviderVerification,
} from '../providers/types'
import { installOutcome as installBrew, uninstallOutcome as uninstallBrew } from '../package-manager/brew'
import { installOutcome as installBun, uninstallOutcome as uninstallBun } from '../package-manager/bun'
import { installOutcome as installCargo, uninstallOutcome as uninstallCargo } from '../package-manager/cargo'
import { runPackageMutationOutcome } from '../package-manager/context-mutation'
import {
  inferDenoBinaryName,
  installOutcome as installDeno,
  uninstallOutcome as uninstallDeno,
} from '../package-manager/deno'
import { installOutcome as installMise, uninstallOutcome as uninstallMise } from '../package-manager/mise'
import { installOutcome as installNpm, uninstallOutcome as uninstallNpm } from '../package-manager/npm'
import { installOutcome as installPip, uninstallOutcome as uninstallPip } from '../package-manager/pip'
import { installOutcome as installUv, uninstallOutcome as uninstallUv } from '../package-manager/uv'
import { installOutcome as installWinget, uninstallOutcome as uninstallWinget } from '../package-manager/winget'
import { firstPartyProviderIds } from '../providers/types'
import { normalizeRegistryUrl } from '../utils/registry'
import { createCoreProviderObservationRegistry } from './provider-observation-registry'

type PackageProviderId = Exclude<ProviderId, 'binary' | 'script'>

interface PackageMutationDriver {
  readonly install: (request: ProviderTargetRequest) => Promise<ProviderOutcome<void>>
  readonly installCommand: (request: ProviderTargetRequest) => readonly string[]
  readonly uninstall: (request: ProviderTargetRequest) => Promise<ProviderOutcome<void>>
  readonly uninstallCommand: (request: ProviderTargetRequest) => readonly string[]
}

export interface CoreInstallationProviderRegistryDependencies {
  readonly executeEffect?: (
    command: readonly string[],
    context: ProviderOperationContext,
  ) => Promise<ProviderOutcome<void>>
  readonly observationRegistry?: ProviderRegistry
  readonly platform?: Platform
}

const packageCapabilities = Object.freeze(['availability', 'observe', 'install', 'uninstall', 'verify'] as const)
const effectCapabilities = Object.freeze(['availability', 'observe', 'install', 'verify'] as const)
const noCapabilities = Object.freeze([])

const packageMutationDrivers = {
  bun: {
    install: request =>
      installBun(request.target.id, request.options?.distTag, request.options?.registry, request.context),
    installCommand: request => {
      const registry = normalizeRegistryUrl(request.options?.registry)
      const target = request.options?.distTag ? `${request.target.id}@${request.options.distTag}` : request.target.id
      return ['bun', 'add', '-g', ...(registry ? ['--registry', registry] : []), target]
    },
    uninstall: request => uninstallBun(request.target.id, request.context),
    uninstallCommand: request => ['bun', 'remove', '-g', request.target.id],
  },
  brew: {
    install: request => installBrew(request.target.id, brewTargetKind(request.target), request.context),
    installCommand: request => brewCommand('install', request.target),
    uninstall: request => uninstallBrew(request.target.id, brewTargetKind(request.target), request.context),
    uninstallCommand: request => brewCommand('uninstall', request.target),
  },
  cargo: {
    install: request => installCargo(request.target.id, mutableArguments(request.target), request.context),
    installCommand: request => ['cargo', 'install', request.target.id, ...(request.target.arguments ?? [])],
    uninstall: request => uninstallCargo(request.target.id, request.context),
    uninstallCommand: request => ['cargo', 'uninstall', request.target.id],
  },
  deno: {
    install: request => installDeno(request.target.id, mutableArguments(request.target), request.context),
    installCommand: request => ['deno', 'install', '--global', ...(request.target.arguments ?? []), request.target.id],
    uninstall: request =>
      uninstallDeno(inferDenoBinaryName(request.target.id, request.target.binaryName), request.context),
    uninstallCommand: request => [
      'deno',
      'uninstall',
      '--global',
      inferDenoBinaryName(request.target.id, request.target.binaryName),
    ],
  },
  mise: {
    install: request => installMise(request.target.id, request.context),
    installCommand: request => ['mise', 'use', '--global', request.target.id],
    uninstall: request => uninstallMise(request.target.id, request.context),
    uninstallCommand: request => ['mise', 'unuse', '--global', request.target.id],
  },
  npm: {
    install: request =>
      installNpm(request.target.id, request.options?.distTag, request.options?.registry, request.context),
    installCommand: request => {
      const registry = normalizeRegistryUrl(request.options?.registry)
      const target = request.options?.distTag ? `${request.target.id}@${request.options.distTag}` : request.target.id
      return ['npm', 'install', '-g', target, ...(registry ? ['--registry', registry] : [])]
    },
    uninstall: request => uninstallNpm(request.target.id, request.context),
    uninstallCommand: request => ['npm', 'uninstall', '-g', request.target.id],
  },
  pip: {
    install: request => installPip(request.target.id, request.context),
    installCommand: request => ['pip', 'install', request.target.id],
    uninstall: request => uninstallPip(request.target.id, request.context),
    uninstallCommand: request => ['pip', 'uninstall', '-y', request.target.id],
  },
  uv: {
    install: request => installUv(request.target.id, mutableArguments(request.target), request.context),
    installCommand: request => ['uv', 'tool', 'install', request.target.id, ...(request.target.arguments ?? [])],
    uninstall: request => uninstallUv(request.target.id, request.context),
    uninstallCommand: request => ['uv', 'tool', 'uninstall', request.target.id],
  },
  winget: {
    install: request => installWinget(request.target.id, request.context),
    installCommand: request => wingetCommand('install', request.target),
    uninstall: request => uninstallWinget(request.target.id, request.context),
    uninstallCommand: request => wingetCommand('uninstall', request.target),
  },
} satisfies Readonly<Record<PackageProviderId, PackageMutationDriver>>

export function createCoreInstallationProviderRegistry(
  dependencies: CoreInstallationProviderRegistryDependencies = {},
): ProviderRegistry {
  const observationRegistry = dependencies.observationRegistry ?? createCoreProviderObservationRegistry()
  const platform = dependencies.platform ?? currentPlatform()
  const executeEffect =
    dependencies.executeEffect ??
    ((command: readonly string[], context: ProviderOperationContext) =>
      runPackageMutationOutcome(command, context, 'install effect failed'))

  const adapters = firstPartyProviderIds.map(id => {
    const observation = observationRegistry.get(id)
    if (!observation) throw new Error(`Core observation registry is missing first-party provider ${id}.`)
    return id === 'binary' || id === 'script'
      ? createEffectAdapter(id, observation, platform, executeEffect)
      : createPackageAdapter(id, observation, packageMutationDrivers[id])
  })
  const adapterList = Object.freeze([...adapters])
  const adaptersById = new Map(adapterList.map(adapter => [adapter.id, adapter] as const))

  return Object.freeze({
    get: (id: ProviderId) => adaptersById.get(id),
    getCapabilities: (id: ProviderId) =>
      adaptersById.has(id)
        ? id === 'binary' || id === 'script'
          ? effectCapabilities
          : packageCapabilities
        : noCapabilities,
    list: () => adapterList,
  })
}

function createPackageAdapter<Id extends PackageProviderId>(
  id: Id,
  observation: ProviderAdapter,
  driver: PackageMutationDriver,
): ProviderAdapter & { readonly id: Id } {
  const adapter: ProviderAdapter & { readonly id: Id } = {
    availability: observation.availability,
    id,
    install: (request: ProviderTargetRequest) =>
      runMutation(id, request.target, driver.installCommand(request), () => driver.install(request)),
    observe: observation.observe,
    uninstall: (request: ProviderTargetRequest) =>
      runMutation(id, request.target, driver.uninstallCommand(request), () => driver.uninstall(request)),
    verify: (request: ProviderTargetRequest) => verifyObservation(observation, request),
  }
  return Object.freeze(adapter)
}

function createEffectAdapter<Id extends 'binary' | 'script'>(
  id: Id,
  observation: ProviderAdapter,
  platform: Platform,
  execute: (command: readonly string[], context: ProviderOperationContext) => Promise<ProviderOutcome<void>>,
): ProviderAdapter & { readonly id: Id } {
  const adapter: ProviderAdapter & { readonly id: Id } = {
    availability: observation.availability,
    id,
    async install(request: ProviderTargetRequest): Promise<ProviderOutcome<ProviderMutationEvidence>> {
      const effect = request.target.effect
      if (!effect) {
        return {
          evidence: [{ kind: 'provider' as const, value: id }],
          kind: 'failed',
          reason: `${id} install target ${request.target.id} has no execution effect`,
          remediation: 'Select a candidate with an explicit shell-script or executable effect.',
          retryable: false,
        }
      }
      const command = effectCommand(effect, platform)
      return runMutation(id, request.target, command, () => execute(command, request.context))
    },
    observe: observation.observe,
    verify: (request: ProviderTargetRequest) => verifyObservation(observation, request),
  }
  return Object.freeze(adapter)
}

async function runMutation(
  providerId: ProviderId,
  target: ProviderTarget,
  intendedCommand: readonly string[],
  invoke: () => Promise<ProviderOutcome<void>>,
): Promise<ProviderOutcome<ProviderMutationEvidence>> {
  const outcome = await invoke()
  if (outcome.kind === 'success') {
    return {
      kind: 'success',
      value: { evidence: mutationEvidence(providerId, intendedCommand), target },
    }
  }
  if (outcome.kind !== 'failed') return outcome

  const command = outcome.command ?? intendedCommand
  return {
    ...outcome,
    command,
    evidence: mergeMutationEvidence(providerId, command, outcome.evidence),
  }
}

async function verifyObservation(
  observation: ProviderAdapter,
  request: ProviderTargetRequest,
): Promise<ProviderOutcome<ProviderVerification>> {
  const outcome = await observation.observe(request)
  if (outcome.kind !== 'success') return outcome
  const evidence = outcome.value.evidence ?? []
  return {
    kind: 'success',
    value:
      outcome.value.kind === 'absent'
        ? {
            evidence,
            kind: 'unsatisfied',
            reason: `${request.target.id} is not installed through ${observation.id}`,
          }
        : { evidence, kind: 'satisfied' },
  }
}

function mutationEvidence(providerId: ProviderId, command: readonly string[]): readonly ProviderEvidence[] {
  return [
    { kind: 'provider', value: providerId },
    { kind: 'command', value: command.join(' ') },
  ]
}

function mergeMutationEvidence(
  providerId: ProviderId,
  command: readonly string[],
  additional: readonly ProviderEvidence[] | undefined,
): readonly ProviderEvidence[] {
  const canonical = mutationEvidence(providerId, command)
  if (!additional?.length) return canonical
  return [
    ...canonical,
    ...additional.filter(
      item => !canonical.some(required => required.kind === item.kind && required.value === item.value),
    ),
  ]
}

function mutableArguments(target: ProviderTarget): string[] | undefined {
  return target.arguments ? [...target.arguments] : undefined
}

function brewTargetKind(target: ProviderTarget): 'cask' | 'package' {
  return target.kind === 'cask' ? 'cask' : 'package'
}

function brewCommand(action: 'install' | 'uninstall', target: ProviderTarget): readonly string[] {
  return ['brew', action, ...(target.kind === 'cask' ? ['--cask'] : []), target.id]
}

function wingetCommand(action: 'install' | 'uninstall', target: ProviderTarget): readonly string[] {
  return ['winget', action, '--id', target.id, '-e']
}

function effectCommand(effect: ProviderExecutionEffect, platform: Platform): readonly string[] {
  if (effect.kind === 'executable') return effect.command
  return platform === 'windows' ? ['powershell.exe', '-Command', effect.command] : ['sh', '-c', effect.command]
}

function currentPlatform(): Platform {
  switch (process.platform) {
    case 'win32':
      return 'windows'
    case 'darwin':
      return 'macos'
    default:
      return 'linux'
  }
}
