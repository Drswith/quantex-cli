import type { AgentDefinition, Platform } from '../../src/agents'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { getAllAgents } from '../../src/agents'

export type CanaryScope = 'full' | 'quick'

export interface CanaryMatrixEntry {
  readonly agent: string
  readonly provider: string
  readonly requireVersion: boolean
}

export interface CanaryMatrix {
  readonly include: CanaryMatrixEntry[]
}

export const QUICK_CANARY_AGENTS = ['codex', 'opencode', 'pi', 'qoder'] as const

const CATALOG_DIRECTORY = fileURLToPath(new URL('../../src/agents/catalog/', import.meta.url))

interface RawCatalogCandidate {
  readonly probes?: unknown
}

interface RawCatalogAgent {
  readonly platforms?: Partial<Record<Platform, RawCatalogCandidate[]>>
}

export async function resolveCanaryMatrix(scope: CanaryScope, platform: Platform = 'linux'): Promise<CanaryMatrix> {
  if (scope !== 'quick' && scope !== 'full') {
    throw new Error(`Unknown canary scope "${scope}". Expected quick or full.`)
  }

  const catalogAgents = getAllAgents()
  const agents = scope === 'quick' ? resolveQuickAgents(catalogAgents, platform) : catalogAgents
  const entries: CanaryMatrixEntry[] = []

  for (const agent of agents) {
    const methods = agent.platforms[platform] ?? []
    const selectedMethodIndex = methods.findIndex(method => method.type === 'bun')
    const selectedMethod = methods[selectedMethodIndex >= 0 ? selectedMethodIndex : 0]
    if (!selectedMethod) {
      if (scope === 'quick') {
        throw new Error(`Quick canary agent "${agent.name}" has no ${platform} install candidate.`)
      }
      continue
    }

    const rawAgent = await readRawCatalogAgent(agent.name)
    const rawCandidates = rawAgent.platforms?.[platform] ?? []
    const rawCandidate = rawCandidates[selectedMethodIndex >= 0 ? selectedMethodIndex : 0]
    if (!rawCandidate) {
      throw new Error(`Catalog metadata for "${agent.name}" has no ${platform} candidate.`)
    }

    entries.push({
      agent: agent.name,
      provider: selectedMethod.type,
      requireVersion: hasInstalledVersionProbe(rawCandidate.probes),
    })
  }

  entries.sort((left, right) => left.agent.localeCompare(right.agent))
  return { include: entries }
}

function resolveQuickAgents(catalogAgents: AgentDefinition[], platform: Platform): AgentDefinition[] {
  return QUICK_CANARY_AGENTS.map(name => {
    const agent = catalogAgents.find(candidate => candidate.name === name)
    if (!agent) throw new Error(`Quick canary anchor "${name}" is missing from the agent catalog.`)
    if (!agent.platforms[platform]?.length) {
      throw new Error(`Quick canary anchor "${name}" has no ${platform} install candidate.`)
    }
    return agent
  })
}

async function readRawCatalogAgent(name: string): Promise<RawCatalogAgent> {
  const raw = await readFile(`${CATALOG_DIRECTORY}${name}.json`, 'utf8')
  return JSON.parse(raw) as RawCatalogAgent
}

function hasInstalledVersionProbe(probes: unknown): boolean {
  return Array.isArray(probes) && probes.some(probe => probe === 'installed-version')
}

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

if (import.meta.main) {
  const scope = (readOption('--scope') ?? process.env.QTX_CANARY_SCOPE ?? 'quick') as CanaryScope
  const platform = (readOption('--platform') ?? process.env.QTX_CANARY_PLATFORM ?? 'linux') as Platform
  const matrix = await resolveCanaryMatrix(scope, platform)
  console.log(JSON.stringify(matrix))
}
