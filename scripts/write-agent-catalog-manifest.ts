import type { CatalogSourceEntry, NormalizedInstallCandidate } from '../src/agents/schema'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format } from 'oxfmt'
import { catalogSourceEntrySchema } from '../src/agents/schema'
import { firstPartyProviderIds } from '../src/providers/types'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultCatalogDir = resolve(rootDir, 'src/agents/catalog')
const defaultCatalogDataOutputPath = resolve(rootDir, 'src/agents/generated/catalog-data.ts')
const defaultCatalogAgentsOutputPath = resolve(rootDir, 'src/agents/generated/catalog-agents.ts')
const defaultCatalogAdapterPath = resolve(rootDir, 'src/agents/catalog.ts')
const defaultCatalogSupportOutputPath = resolve(rootDir, 'src/agents/generated/catalog-support.json')
const defaultCatalogSupportMarkdownOutputPath = resolve(rootDir, 'docs/generated/agent-provider-support.md')

const platformOrder = ['linux', 'macos', 'windows'] as const

interface CatalogEntryFile {
  fileName: string
  name: string
  source: CatalogSourceEntry
}

interface AgentCatalogManifestOptions {
  catalogAdapterPath?: string
  catalogAgentsOutputPath?: string
  catalogDataOutputPath?: string
  catalogDir?: string
  catalogSupportMarkdownOutputPath?: string
  catalogSupportOutputPath?: string
}

export interface AgentCatalogManifest {
  catalogAgentsSource: string
  catalogDataSource: string
  catalogSupportMarkdown: string
  catalogSupportSource: string
  entries: CatalogEntryFile[]
}

export async function writeAgentCatalogManifest(options: AgentCatalogManifestOptions = {}): Promise<void> {
  const manifest = await buildAgentCatalogManifest(options)
  const catalogDataOutputPath = options.catalogDataOutputPath ?? defaultCatalogDataOutputPath
  const catalogAgentsOutputPath = options.catalogAgentsOutputPath ?? defaultCatalogAgentsOutputPath
  const catalogSupportOutputPath = options.catalogSupportOutputPath ?? defaultCatalogSupportOutputPath
  const catalogSupportMarkdownOutputPath =
    options.catalogSupportMarkdownOutputPath ?? defaultCatalogSupportMarkdownOutputPath

  await mkdir(dirname(catalogDataOutputPath), { recursive: true })
  await mkdir(dirname(catalogSupportOutputPath), { recursive: true })
  await mkdir(dirname(catalogSupportMarkdownOutputPath), { recursive: true })
  await writeFile(catalogDataOutputPath, manifest.catalogDataSource)
  await writeFile(catalogAgentsOutputPath, manifest.catalogAgentsSource)
  await writeFile(catalogSupportOutputPath, manifest.catalogSupportSource)
  await writeFile(catalogSupportMarkdownOutputPath, manifest.catalogSupportMarkdown)
}

export async function buildAgentCatalogManifest(
  options: AgentCatalogManifestOptions = {},
): Promise<AgentCatalogManifest> {
  const catalogDir = options.catalogDir ?? defaultCatalogDir
  const catalogDataOutputPath = options.catalogDataOutputPath ?? defaultCatalogDataOutputPath
  const catalogAgentsOutputPath = options.catalogAgentsOutputPath ?? defaultCatalogAgentsOutputPath
  const catalogAdapterPath = options.catalogAdapterPath ?? defaultCatalogAdapterPath
  const entries = await readCatalogEntries(catalogDir)
  const support = buildCatalogSupport(entries)
  const catalogSupportSource = (
    await format('catalog-support.json', `${JSON.stringify(support, null, 2)}\n`, { printWidth: 120 })
  ).code

  return {
    catalogAgentsSource: renderCatalogAgentsManifest(entries, catalogAgentsOutputPath, catalogAdapterPath),
    catalogDataSource: renderCatalogDataManifest(entries, catalogDataOutputPath, catalogDir),
    catalogSupportMarkdown: renderCatalogSupportMarkdown(support),
    catalogSupportSource,
    entries,
  }
}

export async function readCatalogEntries(catalogDir: string = defaultCatalogDir): Promise<CatalogEntryFile[]> {
  const dirEntries = await readdir(catalogDir, { withFileTypes: true })
  const files = dirEntries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right))

  if (files.length === 0) {
    throw new Error(`No agent catalog JSON files found in ${catalogDir}.`)
  }

  const entries: CatalogEntryFile[] = []

  for (const fileName of files) {
    const filePath = resolve(catalogDir, fileName)
    const rawValue = await readFile(filePath, 'utf8')
    const parsedValue = JSON.parse(rawValue) as unknown
    const expectedName = basename(fileName, '.json')

    if (typeof parsedValue !== 'object' || parsedValue === null || !('name' in parsedValue)) {
      throw new Error(`Catalog file ${fileName} must contain an object with a string name.`)
    }

    const name = (parsedValue as { name?: unknown }).name
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`Catalog file ${fileName} must contain a non-empty string name.`)
    }

    if (name !== expectedName) {
      throw new Error(`Catalog filename ${fileName} must match entry name ${name}.`)
    }

    const source = catalogSourceEntrySchema.parse(parsedValue)
    entries.push({ fileName, name, source })
  }

  return entries
}

interface ProviderSupport {
  agents: string[]
  platforms: string[]
  probes: string[]
  targetKinds: string[]
}

interface CatalogSupport {
  agents: Array<{
    binaryName: string
    name: string
    platforms: Record<string, Array<{ probes: string[]; provider: string; targetId: string; targetKind: string }>>
  }>
  providers: Record<string, ProviderSupport>
  schemaVersion: 1
}

function buildCatalogSupport(entries: CatalogEntryFile[]): CatalogSupport {
  const providerSets = Object.fromEntries(
    firstPartyProviderIds.map(id => [
      id,
      {
        agents: new Set<string>(),
        platforms: new Set<string>(),
        probes: new Set<string>(),
        targetKinds: new Set<string>(),
      },
    ]),
  ) as Record<
    (typeof firstPartyProviderIds)[number],
    { agents: Set<string>; platforms: Set<string>; probes: Set<string>; targetKinds: Set<string> }
  >

  const agents = entries.map(({ source }) => {
    const platforms: CatalogSupport['agents'][number]['platforms'] = {}
    for (const platform of platformOrder) {
      const candidates = source.platforms[platform]
      if (!candidates) continue
      platforms[platform] = candidates.map(candidate => {
        if ('type' in candidate) {
          throw new Error(`${source.name} still uses legacy ${candidate.type} catalog methods on ${platform}`)
        }
        collectProviderSupport(providerSets[candidate.provider], source.name, platform, candidate)
        return {
          probes: [...(candidate.probes ?? [])].sort(),
          provider: candidate.provider,
          targetId: candidate.target.id,
          targetKind: candidate.target.kind,
        }
      })
    }
    return { binaryName: source.binaryName, name: source.name, platforms }
  })

  const providers = Object.fromEntries(
    firstPartyProviderIds.map(id => {
      const support = providerSets[id]
      return [
        id,
        {
          agents: [...support.agents].sort(),
          platforms: [...support.platforms].sort(),
          probes: [...support.probes].sort(),
          targetKinds: [...support.targetKinds].sort(),
        },
      ]
    }),
  )

  return { agents, providers, schemaVersion: 1 }
}

function collectProviderSupport(
  support: { agents: Set<string>; platforms: Set<string>; probes: Set<string>; targetKinds: Set<string> },
  agent: string,
  platform: string,
  candidate: NormalizedInstallCandidate,
): void {
  support.agents.add(agent)
  support.platforms.add(platform)
  support.targetKinds.add(candidate.target.kind)
  for (const probe of candidate.probes ?? []) support.probes.add(probe)
}

function renderCatalogSupportMarkdown(support: CatalogSupport): string {
  const rows = firstPartyProviderIds
    .map(id => {
      const provider = support.providers[id]
      return `| \`${id}\` | ${provider.agents.length} | ${list(provider.platforms)} | ${list(provider.targetKinds)} | ${list(provider.probes)} |`
    })
    .join('\n')

  return `# Generated Agent Provider Support\n\n> Generated by \`bun run agent-catalog:generate\` from validated normalized catalog candidates. Do not edit manually.\n\n| Provider | Agents | Platforms | Target kinds | Declared probes |\n| --- | ---: | --- | --- | --- |\n${rows}\n`
}

function list(values: string[]): string {
  return values.length > 0 ? values.map(value => `\`${value}\``).join(', ') : '—'
}

function renderCatalogDataManifest(
  entries: CatalogEntryFile[],
  catalogDataOutputPath: string,
  catalogDir: string,
): string {
  const imports = entries
    .map((entry, index) => {
      const importPath = getImportPath(catalogDataOutputPath, resolve(catalogDir, entry.fileName))
      return `import agent${index} from '${importPath}'`
    })
    .join('\n')
  const values = entries.map((_entry, index) => `  agent${index},`).join('\n')

  return `// Generated by scripts/write-agent-catalog-manifest.ts. Do not edit by hand.\n\n${imports}\n\nexport const catalogData = [\n${values}\n]\n`
}

function renderCatalogAgentsManifest(
  entries: CatalogEntryFile[],
  catalogAgentsOutputPath: string,
  catalogAdapterPath: string,
): string {
  const catalogImportPath = getImportPath(catalogAgentsOutputPath, catalogAdapterPath).replace(/\.ts$/, '')
  const exports = entries
    .map(entry => `export const ${toIdentifier(entry.name)} = getCatalogAgent('${entry.name}')`)
    .join('\n')

  return `// Generated by scripts/write-agent-catalog-manifest.ts. Do not edit by hand.\n\nimport { getCatalogAgent } from '${catalogImportPath}'\n\n${exports}\n`
}

function getImportPath(fromFilePath: string, toFilePath: string): string {
  const normalizedPath = relative(dirname(fromFilePath), toFilePath).replaceAll('\\', '/')
  return normalizedPath.startsWith('.') ? normalizedPath : `./${normalizedPath}`
}

function toIdentifier(name: string): string {
  const identifier = name.replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase())
  if (!/^[a-zA-Z_$][\w$]*$/.test(identifier)) {
    throw new Error(`Catalog entry ${name} cannot be represented as a TypeScript named export.`)
  }

  return identifier
}

if (import.meta.main) {
  await writeAgentCatalogManifest()
}
