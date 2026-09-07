import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const leftoverKeepHang =
  'S2 leftover scan: KEEP product-path hang here (CLI shell leftover; do not restore src/lifecycle).'

const scanDirs = ['src/commands', 'src/command-contract', 'src/generated', 'src/release-artifacts'] as const
const scanFilesExtra = ['src/command-runtime.ts', 'src/cli.ts', 'src/index.ts'] as const
const processEntries = ['src/cli.ts'] as const

const hangFiles = [
  'src/cli.ts',
  'src/index.ts',
  'src/command-runtime.ts',
  'src/command-contract/index.ts',
  'src/commands/run.ts',
  'src/commands/capabilities.ts',
  'src/commands/commands.ts',
  'src/commands/schema.ts',
  'src/commands/config.ts',
  'src/release-artifacts/index.ts',
] as const

const importerRoots = ['src', 'test', 'packages', 'scripts'] as const
const importRe =
  /(?:from|import|export)\s+(?:type\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g

describe('S2 CLI shell leftover scan after S1', () => {
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

  it('does not expand a commands barrel or public SDK surface', async () => {
    await expect(source('src/commands/index.ts')).rejects.toThrow()

    const packageEntry = await source('packages/core/src/index.ts')
    expect(packageEntry).toContain('createQuantex')
    expect(packageEntry).not.toContain('lifecycle')
    expect(packageEntry).not.toContain("from './commands")
  })

  it('hangs product-path KEEP comments on existing CLI shell files', async () => {
    for (const path of hangFiles) {
      const text = await source(path)
      expect(text, path).toContain(leftoverKeepHang)
      expect(text, path).toContain('KEEP (S2)')
    }
  })

  it('does not fold published v1 facade, config, capabilities, commands, or schema', async () => {
    const compatibility = await source('src/compatibility/index.ts')
    expect(compatibility).toContain("from '../commands/capabilities'")
    expect(compatibility).toContain("from '../commands/commands'")
    expect(compatibility).toContain("from '../commands/schema'")
    expect(compatibility).toContain("from '../config'")
    expect(compatibility).toContain("from '../commands/exec'")
    expect(compatibility).toContain("from '../commands/ensure'")
    expect(compatibility).toContain("from '../commands/inspect'")
    expect(compatibility).toContain("from '../commands/resolve'")
    expect(compatibility).toContain('KEEP (L5): published v1 root facade')

    await source('src/commands/capabilities.ts')
    await source('src/commands/commands.ts')
    await source('src/commands/schema.ts')
    await source('src/commands/config.ts')
    await source('src/config/index.ts')
    await source('src/index.ts')
  })

  it('treats src/cli.ts as the process entry, not a zero-ref leftover', async () => {
    const pkg = JSON.parse(await source('package.json')) as {
      bin: Record<string, string>
      scripts: Record<string, string>
    }
    expect(pkg.bin.quantex).toBe('./dist/cli.mjs')
    expect(pkg.bin.qtx).toBe('./dist/cli.mjs')
    expect(pkg.scripts.dev).toBe('bun run src/cli.ts')

    const tsdown = await source('tsdown.config.ts')
    expect(tsdown).toContain("'src/cli.ts'")
    expect(tsdown).toContain("'src/index.ts'")

    const cli = await source('src/cli.ts')
    expect(cli).toContain("from './command-contract/commander'")
    expect(cli).toContain("from './commands/shortcut'")
    expect(cli).toContain("from './commands/run'")
  })

  it('proves zero leftover modules and zero test-only leftovers in the S2 scan areas', async () => {
    const graph = await buildImportGraph()
    const processEntrySet = new Set<string>(processEntries)
    const zeroRef = [...graph.incoming.entries()]
      .filter(([path, refs]) => refs.length === 0 && !processEntrySet.has(path))
      .map(([path]) => path)
    const testOnly = [...graph.incoming.entries()]
      .filter(([, refs]) => refs.length > 0 && refs.every(ref => ref.startsWith('test/')))
      .map(([path]) => path)

    expect(graph.scanFiles.every(path => !path.includes('\\'))).toBe(true)
    expect(zeroRef, 'S2 scan files must have at least one importer or be the process entry').toEqual([])
    expect(testOnly, 'S2 scan files must have a production importer').toEqual([])
    expect(graph.incoming.get('src/cli.ts'), 'process entry is executed, not imported').toEqual([])
  })

  it('keeps established CLI shells as live facades, not foldable leftovers', async () => {
    const graph = await buildImportGraph()
    const facades = [
      'src/index.ts',
      'src/command-runtime.ts',
      'src/command-contract/index.ts',
      'src/command-contract/registry.ts',
      'src/command-contract/handlers.ts',
      'src/command-contract/commander.ts',
      'src/command-contract/presentation.ts',
      'src/commands/exec.ts',
      'src/commands/installation-routing.ts',
      'src/commands/core-installation-cli.ts',
      'src/commands/cli-read-projection.ts',
      'src/commands/unmanaged-install-compatibility.ts',
      'src/generated/build-meta.ts',
      'src/release-artifacts/index.ts',
    ] as const

    for (const path of facades) {
      const productionImporters = (graph.incoming.get(path) ?? []).filter(
        importer => !importer.startsWith('test/') && importer !== path,
      )
      expect(productionImporters.length, `${path} must keep production importers`).toBeGreaterThan(0)
    }

    const root = await source('src/index.ts')
    expect(root).toContain("export * from './compatibility'")

    const contractBarrel = await source('src/command-contract/index.ts')
    expect(contractBarrel).toContain("from './registry'")
    expect(contractBarrel).not.toContain("from './handlers'")

    const generated = await source('src/generated/build-meta.ts')
    expect(generated).toContain('export const BUILD_VERSION')
    expect(generated).not.toContain('KEEP (S2)')
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
  for (const extra of scanFilesExtra) files.add(extra)
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
