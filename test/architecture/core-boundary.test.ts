import { access, readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CORE_SOURCE = join(ROOT, 'packages', 'core', 'src')
const PACKAGE_ENTRY = join(CORE_SOURCE, 'index.ts')
const PACKAGE_INTERNAL = join(CORE_SOURCE, 'internal.ts')
const PACKAGE_MANIFEST = join(ROOT, 'packages', 'core', 'package.json')
const MODEL_LEAF = 'packages/core/src/lifecycle/model.ts'

const forbiddenSpecifierPatterns = [
  /(?:^|\/)cli-context(?:$|\/)/u,
  /(?:^|\/)commands?(?:$|\/)/u,
  /(?:^|\/)command-contract(?:$|\/)/u,
  /(?:^|\/)command-runtime(?:$|\/)/u,
  /(?:^|\/)presenters?(?:$|\/)/u,
  /(?:^|\/)presentation(?:$|\/)/u,
  /(?:^|\/)release-artifacts?(?:$|\/)/u,
  /(?:^|\/)self(?:$|\/)/u,
  /runtime\/cli-operation-context/u,
  /(?:^|\/)services(?:$|\/)/u,
  /(?:^|\/)compatibility(?:$|\/)/u,
  /(?:^|\/)idempotency(?:$|\/)/u,
  /(?:^|\/)planning(?:$|\/)/u,
  /(?:^|\/)inspection(?:$|\/)/u,
  /(?:^|\/)config(?:$|\/)/u,
  /(?:^|\/)output(?:$|\/)/u,
  /utils\/user-output(?:$|\/)/u,
  /utils\/color(?:$|\/)/u,
  /utils\/cli-child-process(?:$|\/)/u,
  /^(?:commander|picocolors|prompts)$/u,
]

const allowedSharedPrefixes = [
  'src/agents/',
  'src/providers/',
  'src/state/',
  'src/package-manager/',
  'src/runtime/',
  'src/agent-update/',
  'src/utils/',
] as const

const allowedSharedFiles = new Set(['src/agents.ts', 'src/state.ts', 'src/runtime.ts', 'src/providers.ts'])

const documentedLeafImporters = new Set([
  'src/state/schema.ts',
  'src/state/store.ts',
  'src/state/index.ts',
  'src/package-manager/index.ts',
])

const deferredPackageManagerCliCoupling = new Set([
  'packages/core/src/update-production.ts',
  'packages/core/src/uninstall-executor.ts',
])

describe('Core package boundary', () => {
  it('owns Core implementation under packages/core/src and leaves root src/core empty', async () => {
    await expect(access(join(ROOT, 'src', 'core'))).rejects.toThrow()
    const entry = await readFile(PACKAGE_ENTRY, 'utf8')
    const internal = await readFile(PACKAGE_INTERNAL, 'utf8')
    expect(entry).toContain("export { createQuantex } from './client'")
    expect(entry).not.toContain('../../../src/core')
    expect(internal).toContain("from './invocation'")
    expect(internal).not.toContain('../../../src/core')
    expect(importSpecifiers(entry)).toEqual(['./client', './types'])
  })

  it('keeps Core-owned modules free of direct CLI, presentation, self, and release dependencies', async () => {
    const files = await typescriptFiles(CORE_SOURCE)
    const violations: string[] = []

    for (const file of files) {
      const source = await readFile(file, 'utf8')
      for (const specifier of importSpecifiers(source)) {
        if (forbiddenSpecifierPatterns.some(pattern => pattern.test(specifier))) {
          violations.push(`${repositoryPath(file)} -> ${specifier}`)
        }
      }
      if (/\bconsole\s*\./u.test(source)) violations.push(`${repositoryPath(file)} uses console`)
      if (/\bprocess\s*\.\s*exit\b/u.test(source)) violations.push(`${repositoryPath(file)} uses process.exit`)
    }

    expect(violations).toEqual([])
  })

  it('publishes one Core source entry and only the supported package subpaths', async () => {
    const entry = await readFile(PACKAGE_ENTRY, 'utf8')
    const manifest = JSON.parse(await readFile(PACKAGE_MANIFEST, 'utf8')) as {
      exports?: Record<string, unknown>
    }

    expect(Object.keys(manifest.exports ?? {}).sort()).toEqual(['.', './package.json'])
    expect(entry).not.toMatch(/\b(provider|receipt|command|presenter|self-upgrade|release)\b/iu)
    expect(entry).not.toContain('./lifecycle')
    expect(entry).not.toContain('engine')
    expect(entry).not.toContain('route')
  })

  it('keeps the eager public runtime dependency closure outside mutation and CLI infrastructure', async () => {
    const closure = await runtimeDependencyClosure(PACKAGE_ENTRY, false)
    const allowedOutsideCore = new Set([
      'src/package-manager/managed-install-types.ts',
      'src/providers/types.ts',
      'src/state/schema.ts',
      'src/utils/compare-versions.ts',
      'src/utils/executable-search-paths.ts',
    ])
    const violations = [...closure]
      .map(repositoryPath)
      .filter(file => !file.startsWith('packages/core/src/'))
      .filter(file => !allowedOutsideCore.has(file))

    expect(violations).toEqual([])
    expect([...closure].map(repositoryPath)).not.toContain('packages/core/src/mutation-recipe-catalog.ts')
  })

  it('loads the mutation closure only through the public client dynamic boundary', async () => {
    const eager = await runtimeDependencyClosure(PACKAGE_ENTRY, false)
    const complete = await runtimeDependencyClosure(PACKAGE_ENTRY, true)
    const eagerPaths = [...eager].map(repositoryPath)
    const completePaths = [...complete].map(repositoryPath)

    expect(eagerPaths).not.toContain('packages/core/src/installation-production.ts')
    expect(eagerPaths).not.toContain('src/providers/first-party.ts')
    expect(completePaths).toContain('packages/core/src/installation-production.ts')
    expect(completePaths).toContain('packages/core/src/installation-provider-registry.ts')
    expect(completePaths).not.toContain('src/providers/first-party.ts')
  })

  it('allows only documented root-module imports from Core', async () => {
    const files = await typescriptFiles(CORE_SOURCE)
    const violations: string[] = []

    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      for (const specifier of [...staticSpecifiers(sourceFile), ...dynamicImportSpecifiers(sourceFile)]) {
        if (!specifier.startsWith('.')) continue
        const resolved = await resolveTypescriptImport(file, specifier)
        const path = repositoryPath(resolved)
        if (path.startsWith('packages/core/src/')) continue
        const allowed = allowedSharedFiles.has(path) || allowedSharedPrefixes.some(prefix => path.startsWith(prefix))
        if (!allowed) violations.push(`${repositoryPath(file)} -> ${path}`)
        if (path === 'src/runtime/cli-operation-context.ts' || path === 'src/runtime/index.ts') {
          violations.push(`${repositoryPath(file)} -> ${path}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('limits reverse imports into Core to the documented type leaf', async () => {
    const srcFiles = await typescriptFiles(join(ROOT, 'src'))
    const violations: string[] = []

    for (const file of srcFiles) {
      const importer = repositoryPath(file)
      if (importer.startsWith('src/commands/') || importer.startsWith('src/services/')) continue
      if (
        importer.startsWith('src/idempotency') ||
        importer.startsWith('src/planning/') ||
        importer.startsWith('src/compatibility/') ||
        importer.startsWith('src/inspection/')
      ) {
        continue
      }
      const source = await readFile(file, 'utf8')
      for (const specifier of importSpecifiers(source)) {
        if (!specifier.includes('packages/core/src') && !specifier.includes('quantex-core')) continue
        if (specifier === 'quantex-core' || specifier === 'quantex-core/internal') {
          if (!cliOwnedImporter(importer)) violations.push(`${importer} -> ${specifier}`)
          continue
        }
        const resolved = specifier.startsWith('.')
          ? repositoryPath(await resolveTypescriptImport(file, specifier))
          : specifier
        if (resolved !== MODEL_LEAF && !cliOwnedImporter(importer)) {
          violations.push(`${importer} -> ${resolved}`)
        }
      }
    }

    for (const importer of documentedLeafImporters) {
      const text = await readFile(join(ROOT, importer), 'utf8')
      expect(text).toContain("from '../../packages/core/src/lifecycle/model'")
      expect(text).not.toContain('createQuantex')
      expect(text).not.toContain('packages/core/src/index')
    }

    expect(violations).toEqual([])
  })

  it('records product-locked ownership and physical stop points for providers and state', async () => {
    await access(join(ROOT, 'src', 'providers'))
    await access(join(ROOT, 'src', 'state'))
    await access(join(ROOT, 'src', 'agents'))
    await expect(access(join(CORE_SOURCE, 'providers'))).rejects.toThrow()
    await expect(access(join(CORE_SOURCE, 'state'))).rejects.toThrow()
    await expect(access(join(CORE_SOURCE, 'agents'))).rejects.toThrow()

    const stateIndex = await readFile(join(ROOT, 'src', 'state', 'index.ts'), 'utf8')
    const stateSchema = await readFile(join(ROOT, 'src', 'state', 'schema.ts'), 'utf8')
    expect(stateIndex).toContain("from '../config'")
    expect(stateIndex).toContain("from '../self/types'")
    expect(stateSchema).toContain("from '../self/types'")
    expect(stateIndex).toContain("from '../../packages/core/src/lifecycle/model'")

    const providerFiles = await typescriptFiles(join(ROOT, 'src', 'providers'))
    const packageManagerImporters: string[] = []
    const cliLeaks: string[] = []
    for (const file of providerFiles) {
      const source = await readFile(file, 'utf8')
      for (const specifier of importSpecifiers(source)) {
        if (specifier.includes('package-manager')) {
          packageManagerImporters.push(`${repositoryPath(file)} -> ${specifier}`)
        }
        if (
          /(?:^|\/)cli-context(?:$|\/)/u.test(specifier) ||
          /(?:^|\/)commands?(?:$|\/)/u.test(specifier) ||
          /(?:^|\/)self(?:$|\/)/u.test(specifier) ||
          /(?:^|\/)config(?:$|\/)/u.test(specifier)
        ) {
          cliLeaks.push(`${repositoryPath(file)} -> ${specifier}`)
        }
      }
    }

    expect(cliLeaks).toEqual([])
    expect(packageManagerImporters.length).toBeGreaterThan(0)
  })

  it('records the deferred package-manager CLI coupling without allowing new Core to CLI leaks', async () => {
    const files = await typescriptFiles(CORE_SOURCE)
    const packageManagerIndexImporters: string[] = []

    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      for (const specifier of [...staticSpecifiers(sourceFile, false), ...dynamicImportSpecifiers(sourceFile)]) {
        if (!specifier.startsWith('.')) continue
        const resolved = repositoryPath(await resolveTypescriptImport(file, specifier))
        if (resolved === 'src/package-manager/index.ts' || resolved === 'src/package-manager.ts') {
          packageManagerIndexImporters.push(repositoryPath(file))
        }
      }
    }

    expect(new Set(packageManagerIndexImporters)).toEqual(deferredPackageManagerCliCoupling)
  })
})

function cliOwnedImporter(importer: string): boolean {
  return (
    importer.startsWith('src/commands/') ||
    importer.startsWith('src/services/') ||
    importer.startsWith('src/idempotency') ||
    importer.startsWith('src/planning/') ||
    importer.startsWith('src/compatibility/') ||
    importer.startsWith('src/inspection/') ||
    importer.startsWith('src/self/') ||
    importer === 'src/cli.ts' ||
    importer === 'src/cli-context.ts' ||
    importer === 'src/command-runtime.ts'
  )
}

function repositoryPath(file: string): string {
  return relative(ROOT, file).replaceAll('\\', '/')
}

async function typescriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(entry => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return typescriptFiles(path)
      return entry.isFile() && entry.name.endsWith('.ts') ? [path] : []
    }),
  )
  return nested.flat().sort()
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/\b(?:from\s+|import\s*\()(['"])([^'"]+)\1/gu)].map(match => match[2]!)
}

function staticSpecifiers(sourceFile: ts.SourceFile, includeTypeOnly = true): string[] {
  const specifiers: string[] = []
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
      if (!includeTypeOnly && 'importClause' in statement && statement.importClause?.isTypeOnly) continue
      if (!includeTypeOnly && ts.isExportDeclaration(statement) && statement.isTypeOnly) continue
      const specifier = stringSpecifier(statement.moduleSpecifier)
      if (specifier) specifiers.push(specifier)
    }
  }
  return specifiers
}

async function runtimeDependencyClosure(entry: string, includeDynamicImports: boolean): Promise<Set<string>> {
  const visited = new Set<string>()
  const pending = [entry]
  while (pending.length > 0) {
    const file = pending.shift()
    if (!file || visited.has(file)) continue
    visited.add(file)
    const source = await readFile(file, 'utf8')
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    for (const specifier of staticSpecifiers(sourceFile, false)) {
      if (specifier.startsWith('.')) pending.push(await resolveTypescriptImport(file, specifier))
    }
    if (includeDynamicImports) {
      for (const specifier of dynamicImportSpecifiers(sourceFile)) {
        if (specifier.startsWith('.')) pending.push(await resolveTypescriptImport(file, specifier))
      }
    }
  }
  return visited
}

function dynamicImportSpecifiers(sourceFile: ts.SourceFile): string[] {
  const specifiers: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const specifier = stringSpecifier(node.arguments[0])
      if (specifier) specifiers.push(specifier)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return specifiers
}

function stringSpecifier(node: ts.Expression | undefined): string | undefined {
  return node && ts.isStringLiteral(node) ? node.text : undefined
}

async function resolveTypescriptImport(importer: string, specifier: string): Promise<string> {
  const unresolved = join(dirname(importer), specifier)
  for (const candidate of [`${unresolved}.ts`, join(unresolved, 'index.ts')]) {
    try {
      await readFile(candidate, 'utf8')
      return candidate
    } catch {
      // Try the next TypeScript source form.
    }
  }
  throw new Error(`Cannot resolve ${specifier} from ${repositoryPath(importer)}.`)
}
