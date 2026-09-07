import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const leftoverKeepHang =
  'S1 leftover scan: KEEP product-path hang here (thick-area zero-ref; do not restore src/lifecycle).'

const scanDirs = [
  'src/agents',
  'src/providers',
  'src/package-manager',
  'src/utils',
  'src/agent-update',
  'src/runtime',
] as const

const relatedLeftovers = [
  'src/planning',
  'src/inspection',
  'src/state.ts',
  'src/errors.ts',
  'src/cli-context.ts',
  'src/output',
] as const

const hangFiles = [
  'src/agents/index.ts',
  'src/providers/index.ts',
  'src/package-manager/index.ts',
  'src/utils/install.ts',
  'src/agent-update/index.ts',
  'src/runtime/index.ts',
  'src/planning/index.ts',
  'src/inspection/index.ts',
  'src/state.ts',
] as const

const importerRoots = ['src', 'test', 'packages', 'scripts'] as const
const importRe =
  /(?:from|import|export)\s+(?:type\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g

describe('S1 thick-area leftover scan after L5', () => {
  it('does not restore src/lifecycle and keeps Core-internal modules barrel-free', async () => {
    await expect(source('src/lifecycle/index.ts')).rejects.toThrow()
    await expect(readdir(join(ROOT, 'src/lifecycle'))).rejects.toThrow()
    await expect(source('src/core/lifecycle/index.ts')).rejects.toThrow()
  })

  it('keeps already-deleted leftover shells absent', async () => {
    await expect(source('src/self/application.ts')).rejects.toThrow()
    await expect(source('src/core/self-upgrade-production.ts')).rejects.toThrow()
    await expect(source('src/services/self-upgrade.ts')).rejects.toThrow()
    await expect(source('src/services/lifecycle-updates.ts')).rejects.toThrow()
    await expect(source('src/services/lifecycle-execution.ts')).rejects.toThrow()
  })

  it('hangs product-path KEEP comments on existing thick-area files', async () => {
    for (const path of hangFiles) {
      const text = await source(path)
      expect(text, path).toContain(leftoverKeepHang)
      expect(text, path).toContain('KEEP (S1)')
    }
  })

  it('does not fold published v1 facade, config, capabilities, commands, or schema', async () => {
    const compatibility = await source('src/compatibility/index.ts')
    expect(compatibility).toContain("from '../agent-update'")
    expect(compatibility).toContain("from '../agents'")
    expect(compatibility).toContain("from '../package-manager'")
    expect(compatibility).toContain("from '../package-manager/capabilities'")
    expect(compatibility).toContain("from '../inspection'")
    expect(compatibility).toContain("from '../planning'")
    expect(compatibility).toContain("from '../state'")
    expect(compatibility).toContain("from '../utils/exec'")
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

  it('proves zero zero-ref modules and zero test-only leftovers in the S1 scan areas', async () => {
    const graph = await buildImportGraph()
    const zeroRef = [...graph.incoming.entries()].filter(([, refs]) => refs.length === 0).map(([path]) => path)
    const testOnly = [...graph.incoming.entries()]
      .filter(([, refs]) => refs.length > 0 && refs.every(ref => ref.startsWith('test/')))
      .map(([path]) => path)

    expect(zeroRef, 'S1 scan files must have at least one importer').toEqual([])
    expect(testOnly, 'S1 scan files must have a production importer').toEqual([])
  })

  it('keeps established barrels as live convenience facades, not foldable leftovers', async () => {
    const graph = await buildImportGraph()
    const barrels = [
      'src/runtime/index.ts',
      'src/agent-update/index.ts',
      'src/providers/index.ts',
      'src/planning/index.ts',
      'src/inspection/index.ts',
      'src/state.ts',
      'src/agents/index.ts',
      'src/package-manager/index.ts',
    ] as const

    for (const path of barrels) {
      const productionImporters = (graph.incoming.get(path) ?? []).filter(
        importer => !importer.startsWith('test/') && importer !== path,
      )
      expect(productionImporters.length, `${path} must keep production importers`).toBeGreaterThan(0)
    }

    const runtimeBarrel = await source('src/runtime/index.ts')
    expect(runtimeBarrel).toContain("export * from './agent-process'")
    expect(runtimeBarrel).toContain("export * from './ports'")

    const stateBarrel = await source('src/state.ts')
    expect(stateBarrel).toContain("from './state/index'")

    const managedTypes = await source('src/package-manager/managed-install-types.ts')
    expect(managedTypes).toContain('frozen hardcoded managed-install-type list')
    const schema = await source('src/state/schema.ts')
    expect(schema).toContain("from '../package-manager/managed-install-types'")
    expect(schema).not.toContain("from '../package-manager/capabilities'")
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
  for (const leftover of relatedLeftovers) {
    if (leftover.endsWith('.ts')) files.add(leftover)
    else for (const file of await listTs(leftover)) files.add(file)
  }
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
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await listTs(path)))
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) files.push(path)
  }
  return files.sort()
}

function resolveImport(fromFile: string, specifier: string, fileSet: Set<string>): string | undefined {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return undefined
  const abs = resolve(join(ROOT, dirname(fromFile)), specifier)
  const rel = relative(ROOT, abs).replaceAll('\\', '/')
  const candidates = [rel, `${rel}.ts`, join(rel, 'index.ts').replaceAll('\\', '/')]
  return candidates.find(candidate => fileSet.has(candidate))
}

async function source(path: string): Promise<string> {
  return readFile(join(ROOT, path), 'utf8')
}
