import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const leftoverKeepHang =
  'S3 leftover scan: KEEP product-path hang here (Core-internal leftover; do not restore src/lifecycle).'

const scanDirs = ['src/core'] as const
const publishedFacades = ['packages/core/src/index.ts', 'packages/core/src/internal.ts'] as const
const generatedFiles = ['src/core/generated/agent-catalog.ts', 'src/core/generated/mutation-recipe-catalog.ts'] as const

const hangFiles = [
  'src/core/index.ts',
  'src/core/client.ts',
  'src/core/types.ts',
  'src/core/installation-executor.ts',
  'src/core/update-executor.ts',
  'src/core/execution-executor.ts',
  'src/core/self-upgrade-executor.ts',
  'src/core/uninstall-executor.ts',
  'src/core/doctor-diagnosis.ts',
  'src/core/lifecycle/model.ts',
] as const

const importerRoots = ['src', 'test', 'packages', 'scripts'] as const
const importRe =
  /(?:from|import|export)\s+(?:type\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g
const packageAliases = {
  'quantex-core': 'packages/core/src/index.ts',
  'quantex-core/internal': 'packages/core/src/internal.ts',
} as const

describe('S3 Core leftover scan after S2', () => {
  it('does not restore src/lifecycle and keeps Core-internal modules barrel-free', async () => {
    await expect(source('src/lifecycle/index.ts')).rejects.toThrow()
    await expect(readdir(join(ROOT, 'src/lifecycle'))).rejects.toThrow()
    await expect(source('src/core/lifecycle/index.ts')).rejects.toThrow()

    const coreLifecycleEntries = await readdir(join(ROOT, 'src/core/lifecycle'))
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

  it('keeps already-deleted leftover shells absent', async () => {
    await expect(source('src/self/application.ts')).rejects.toThrow()
    await expect(source('src/core/self-upgrade-production.ts')).rejects.toThrow()
    await expect(source('src/services/self-upgrade.ts')).rejects.toThrow()
    await expect(source('src/services/lifecycle-updates.ts')).rejects.toThrow()
    await expect(source('src/services/lifecycle-execution.ts')).rejects.toThrow()
    await expect(source('src/commands/index.ts')).rejects.toThrow()
  })

  it('hangs product-path KEEP comments on existing Core files', async () => {
    for (const path of hangFiles) {
      const text = await source(path)
      expect(text, path).toContain(leftoverKeepHang)
      expect(text, path).toContain('KEEP (S3)')
    }
  })

  it('does not fold published v1 facade, config, capabilities, commands, or schema', async () => {
    const compatibility = await source('src/compatibility/index.ts')
    expect(compatibility).toContain("from '../commands/capabilities'")
    expect(compatibility).toContain("from '../commands/commands'")
    expect(compatibility).toContain("from '../commands/schema'")
    expect(compatibility).toContain("from '../config'")
    expect(compatibility).toContain('KEEP (L5): published v1 root facade')

    await source('src/commands/capabilities.ts')
    await source('src/commands/commands.ts')
    await source('src/commands/schema.ts')
    await source('src/config/index.ts')
    await source('src/index.ts')
  })

  it('keeps the published Core SDK frozen at createQuantex', async () => {
    const publicCore = await source('src/core/index.ts')
    expect(publicCore).toContain("export { createQuantex } from './client'")
    expect(publicCore).toContain("from './types'")
    expect(publicCore).not.toContain('./lifecycle')
    expect(publicCore).not.toContain('../lifecycle')
    expect(publicCore).not.toContain('engine')
    expect(publicCore).not.toContain('route')

    const packageEntry = await source('packages/core/src/index.ts')
    expect(packageEntry).toContain("from '../../../src/core/index'")
    expect(packageEntry).toContain('createQuantex')
    expect(packageEntry).not.toContain('lifecycle')
    expect(packageEntry).not.toContain('engine')
    expect(packageEntry).not.toContain('route')
    expect(packageEntry).not.toContain('KEEP (S3)')

    const packageInternal = await source('packages/core/src/internal.ts')
    expect(packageInternal).toContain("from '../../../src/core/invocation'")
    expect(packageInternal).toContain("from '../../../src/core/mutation-recipe-catalog'")
    expect(packageInternal).toContain("from '../../../src/core/production-observation'")
    expect(packageInternal).not.toContain('lifecycle')
    expect(packageInternal).not.toContain('KEEP (S3)')

    const packageManifest = JSON.parse(await source('packages/core/package.json')) as {
      exports: Record<string, unknown>
    }
    expect(Object.keys(packageManifest.exports).sort()).toEqual(['.', './package.json'])

    const tsdown = await source('packages/core/tsdown.config.ts')
    expect(tsdown).toContain("join(coreRoot, 'src', 'index.ts')")
    expect(tsdown).not.toContain('internal.ts')
  })

  it('proves zero leftover modules and zero test-only leftovers in src/core', async () => {
    const graph = await buildImportGraph()
    const zeroRef = [...graph.incoming.entries()].filter(([, refs]) => refs.length === 0).map(([path]) => path)
    const testOnly = [...graph.incoming.entries()]
      .filter(([, refs]) => refs.length > 0 && refs.every(ref => ref.startsWith('test/')))
      .map(([path]) => path)

    expect(graph.scanFiles.every(path => !path.includes('\\'))).toBe(true)
    expect(zeroRef, 'S3 scan files must have at least one importer').toEqual([])
    expect(testOnly, 'S3 scan files must have a production importer').toEqual([])
  })

  it('keeps Core engines and published facades as live modules, not foldable leftovers', async () => {
    const graph = await buildImportGraph()
    const engines = [
      'src/core/index.ts',
      'src/core/client.ts',
      'src/core/types.ts',
      'src/core/invocation.ts',
      'src/core/installation-executor.ts',
      'src/core/installation-compatibility.ts',
      'src/core/installation-production.ts',
      'src/core/update-executor.ts',
      'src/core/update-compatibility.ts',
      'src/core/update-production.ts',
      'src/core/execution-executor.ts',
      'src/core/self-upgrade-executor.ts',
      'src/core/uninstall-executor.ts',
      'src/core/doctor-diagnosis.ts',
      'src/core/production-observation.ts',
      'src/core/lifecycle/model.ts',
      'src/core/lifecycle/provider-binding.ts',
      'src/core/lifecycle/provider-evidence.ts',
      'src/core/lifecycle/agent-observation.ts',
      'src/core/lifecycle/agent-execution.ts',
      'src/core/lifecycle/update-planner.ts',
      'src/core/lifecycle/uninstall-postcondition.ts',
      'packages/core/src/index.ts',
      'packages/core/src/internal.ts',
    ] as const

    for (const path of engines) {
      const productionImporters = (graph.incoming.get(path) ?? []).filter(
        importer => !importer.startsWith('test/') && importer !== path,
      )
      expect(productionImporters.length, `${path} must keep production importers`).toBeGreaterThan(0)
    }

    const providerEvidence = await source('src/core/lifecycle/provider-evidence.ts')
    expect(providerEvidence).toContain('export async function observeLifecycleProvider')
    expect(providerEvidence).toContain("from './provider-binding'")

    for (const path of generatedFiles) {
      const generated = await source(path)
      expect(generated).toContain('Generated by scripts/build/write-core-agent-catalog.ts')
      expect(generated).not.toContain('KEEP (S3)')
    }
  })

  it('does not publish engine or route identifiers on Core SDK or CLI JSON helpers', async () => {
    const publicCore = await source('src/core/index.ts')
    expect(publicCore).not.toContain('./lifecycle')
    expect(publicCore).not.toContain('engine')
    expect(publicCore).not.toContain('route')

    const packageEntry = await source('packages/core/src/index.ts')
    expect(packageEntry).toContain('createQuantex')
    expect(packageEntry).not.toContain('lifecycle')
    expect(packageEntry).not.toContain('engine')
    expect(packageEntry).not.toContain('route')

    const output = await source('src/output/index.ts')
    expect(output).toContain('schemaVersion: SCHEMA_VERSION')
    expect(output).not.toContain('engine:')
    expect(output).not.toContain('route:')
    expect(output).not.toContain("engine: '")
    expect(output).not.toContain("route: '")

    const presentation = await source('src/command-contract/presentation.ts')
    expect(presentation).toContain('JSON.stringify(result, null, 2)')
    expect(presentation).not.toContain('engine:')
    expect(presentation).not.toContain("route: '")
  })
})

interface ImportGraph {
  scanFiles: string[]
  incoming: Map<string, string[]>
}

async function buildImportGraph(): Promise<ImportGraph> {
  const scanFiles = await collectScanFiles()
  const importerFiles = await collectImporterFiles()
  const fileSet = new Set(importerFiles)
  const texts = new Map<string, string>()
  for (const file of importerFiles) texts.set(file, await source(file))

  const incoming = new Map<string, string[]>()
  for (const file of scanFiles) incoming.set(file, [])

  for (const from of importerFiles) {
    const text = texts.get(from)!
    for (const match of text.matchAll(importRe)) {
      const specifier = match[1] ?? match[2] ?? match[3]
      if (!specifier) continue
      const resolved = resolveImport(from, specifier, fileSet)
      if (!resolved || !incoming.has(resolved) || resolved === from) continue
      incoming.get(resolved)!.push(from)
    }
  }

  return { incoming, scanFiles }
}

async function collectScanFiles(): Promise<string[]> {
  const files = new Set<string>()
  for (const dir of scanDirs) {
    for (const file of await listTs(dir)) files.add(file)
  }
  for (const facade of publishedFacades) files.add(facade)
  return [...files].sort()
}

async function collectImporterFiles(): Promise<string[]> {
  const files: string[] = []
  for (const dir of importerRoots) files.push(...(await listTs(dir)))
  return files.sort()
}

async function listTs(dir: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(join(ROOT, dir), { withFileTypes: true })) {
    const path = toPosix(join(dir, entry.name))
    if (entry.isDirectory()) files.push(...(await listTs(path)))
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) files.push(path)
  }
  return files.sort()
}

function resolveImport(fromFile: string, specifier: string, fileSet: Set<string>): string | undefined {
  if (specifier in packageAliases) return packageAliases[specifier as keyof typeof packageAliases]
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return undefined
  const abs = resolve(join(ROOT, fromFile), '..', specifier)
  const rel = toPosix(relative(ROOT, abs))
  const candidates = [rel, `${rel}.ts`, `${rel}/index.ts`]
  return candidates.find(candidate => fileSet.has(candidate))
}

function toPosix(path: string): string {
  return path.replaceAll('\\', '/')
}

async function source(path: string): Promise<string> {
  return readFile(join(ROOT, path), 'utf8')
}
