import type { AgentDefinition, InstallMethod, InstallType, Platform } from '../../src/agents'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { getAllAgents } from '../../src/agents'

export type CanaryScope = 'full' | 'quick'
export type CanaryCoverage = 'binary-lifecycle' | 'full-lifecycle'
export type CanarySetup = 'default' | 'defer-account-setup' | 'skip-interactive-configuration'

export interface CanaryMatrixEntry {
  readonly agent: string
  readonly coverage: CanaryCoverage
  readonly disableUpdates: boolean
  readonly provider: InstallType
  readonly requireVersion: boolean
  readonly setup: CanarySetup
  readonly sourceConflictProbe: boolean
}

export interface CanaryMatrix {
  readonly include: CanaryMatrixEntry[]
}

export const QUICK_CANARY_AGENTS = ['codex', 'opencode', 'pi', 'qoder'] as const

// Core can only reorder these providers through defaultPackageManager. When an
// agent exposes neither, retain catalog order so the matrix describes the same
// provider that the production CLI will actually select.
const CI_CONFIGURABLE_PROVIDER_PREFERENCE = ['bun', 'npm', 'uv'] as const satisfies readonly InstallType[]

const CANARY_PROVIDER_OVERRIDES: Readonly<Partial<Record<string, InstallType>>> = Object.freeze({
  // Amp's nested postinstall is blocked by Bun's deliberately narrow global
  // trust flow. npm is an existing product-supported preference, and the quick
  // anchors retain real Bun coverage.
  amp: 'npm',
})

const CANARY_COVERAGE_OVERRIDES: Readonly<Partial<Record<string, CanaryCoverage>>> = Object.freeze({
  devin: 'binary-lifecycle',
})

const CANARY_SETUP_OVERRIDES: Readonly<Partial<Record<string, CanarySetup>>> = Object.freeze({
  devin: 'defer-account-setup',
  goose: 'skip-interactive-configuration',
})

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
    const selectedMethodIndex = selectCanaryMethodIndex(agent, methods)
    const selectedMethod = methods[selectedMethodIndex]
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
      coverage: CANARY_COVERAGE_OVERRIDES[agent.name] ?? 'full-lifecycle',
      disableUpdates: agent.name === 'claude',
      provider: selectedMethod.type,
      requireVersion: hasInstalledVersionProbe(rawCandidate.probes),
      setup: CANARY_SETUP_OVERRIDES[agent.name] ?? 'default',
      sourceConflictProbe: agent.name === 'claude',
    })
  }

  entries.sort((left, right) => left.agent.localeCompare(right.agent))
  return { include: entries }
}

function selectCanaryMethodIndex(agent: AgentDefinition, methods: readonly InstallMethod[]): number {
  const override = CANARY_PROVIDER_OVERRIDES[agent.name]
  if (override) {
    const overrideIndex = methods.findIndex(method => method.type === override)
    if (overrideIndex === -1) {
      throw new Error(`Canary provider override for "${agent.name}" references missing ${override} candidate.`)
    }
    return overrideIndex
  }

  for (const provider of CI_CONFIGURABLE_PROVIDER_PREFERENCE) {
    const providerIndex = methods.findIndex(method => method.type === provider)
    if (providerIndex !== -1) return providerIndex
  }

  return 0
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
