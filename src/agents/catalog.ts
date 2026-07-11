import type { CatalogSourceEntry, NormalizedInstallCandidate } from './schema'
import type { AgentDefinition, AgentPackageMetadata, AgentVersionProbe, InstallMethod } from './types'
import { catalogData } from './generated/catalog-data'
import { catalogSourceSchema } from './schema'

export { agentCatalogJsonSchema } from './schema'
export type { AgentCatalogData, AgentCatalogEntry } from './schema'

interface AgentBehaviorExtension {
  versionProbeParser?: AgentVersionProbe['parser']
}

const behaviorExtensions: Partial<Record<string, AgentBehaviorExtension>> = {}

const parsedCatalog = catalogSourceSchema.parse(catalogData)
const agents = parsedCatalog.map(toAgentDefinition)
const agentsByName = new Map(agents.map(agent => [agent.name, agent]))

export function getCatalogAgents(): AgentDefinition[] {
  return agents
}

export function getCatalogAgent(name: string): AgentDefinition {
  const agent = agentsByName.get(name)
  if (!agent) throw new Error(`Unknown catalog agent: ${name}`)
  return agent
}

function toAgentDefinition(entry: CatalogSourceEntry): AgentDefinition {
  const behavior = behaviorExtensions[entry.name]
  const versionProbe = mergeVersionProbe(entry.versionProbe, behavior)
  const packages = projectLegacyPackages(entry)
  const platforms = Object.fromEntries(
    Object.entries(entry.platforms).map(([platform, candidates]) => [
      platform,
      candidates?.map(projectCatalogInstallCandidate),
    ]),
  ) as AgentDefinition['platforms']

  return {
    ...entry,
    ...(packages ? { packages } : {}),
    platforms,
    versionProbe,
  }
}

export function projectCatalogInstallCandidate(candidate: InstallMethod | NormalizedInstallCandidate): InstallMethod {
  if ('type' in candidate) return candidate

  const { provider, target } = candidate
  if (provider === 'script' || provider === 'binary') {
    const effect = target.effect
    if (!isExecutionEffect(effect)) throw new Error(`${provider} catalog candidate requires an execution effect`)
    const command = effect.kind === 'shell-script' ? effect.command : renderExecutableCommand(effect.command)
    return {
      ...(target.binaryName ? { binaryName: target.binaryName } : {}),
      command,
      type: provider,
    }
  }

  const packageMetadataKey = getPackageMetadataKey(provider)
  return {
    ...(target.arguments ? { packageInstallArgs: [...target.arguments] } : {}),
    ...(target.binaryName ? { binaryName: target.binaryName } : {}),
    ...(!packageMetadataKey || candidate.legacy?.packageNameInMethod ? { packageName: target.id } : {}),
    ...(target.kind === 'cask' || target.kind === 'id' ? { packageTargetKind: target.kind } : {}),
    type: provider,
  }
}

function projectLegacyPackages(entry: CatalogSourceEntry): AgentPackageMetadata | undefined {
  const packages: AgentPackageMetadata = { ...entry.packages }

  for (const candidates of Object.values(entry.platforms)) {
    for (const candidate of candidates ?? []) {
      if ('type' in candidate) continue
      const key = getPackageMetadataKey(candidate.provider)
      if (!key) continue
      const current = packages[key]
      if (current && current !== candidate.target.id) {
        throw new Error(`${entry.name} binds conflicting ${key} package targets: ${current} and ${candidate.target.id}`)
      }
      packages[key] = candidate.target.id
    }
  }

  return Object.keys(packages).length > 0 ? packages : undefined
}

function getPackageMetadataKey(
  provider: NormalizedInstallCandidate['provider'],
): keyof AgentPackageMetadata | undefined {
  if (provider === 'bun' || provider === 'npm') return 'npm'
  if (provider === 'cargo' || provider === 'deno' || provider === 'mise' || provider === 'pip' || provider === 'uv') {
    return provider
  }
  return undefined
}

function isExecutionEffect(value: unknown): value is
  | { readonly command: readonly string[]; readonly kind: 'executable' }
  | {
      readonly command: string
      readonly kind: 'shell-script'
    } {
  if (!value || typeof value !== 'object' || !('kind' in value) || !('command' in value)) return false
  if (value.kind === 'shell-script') return typeof value.command === 'string'
  return (
    value.kind === 'executable' && Array.isArray(value.command) && value.command.every(part => typeof part === 'string')
  )
}

function renderExecutableCommand(command: readonly string[]): string {
  return command.map(argument => (argument.includes(' ') ? JSON.stringify(argument) : argument)).join(' ')
}

function mergeVersionProbe(
  versionProbe: AgentDefinition['versionProbe'],
  behavior: AgentBehaviorExtension | undefined,
): AgentDefinition['versionProbe'] {
  if (!versionProbe && !behavior?.versionProbeParser) return undefined

  return {
    ...versionProbe,
    ...(behavior?.versionProbeParser ? { parser: behavior.versionProbeParser } : {}),
  }
}
