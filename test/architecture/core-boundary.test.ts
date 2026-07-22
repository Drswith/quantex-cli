import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CORE_SOURCE = join(ROOT, 'src', 'core')
const PACKAGE_ENTRY = join(ROOT, 'packages', 'core', 'src', 'index.ts')
const PACKAGE_MANIFEST = join(ROOT, 'packages', 'core', 'package.json')

const forbiddenImports = [
  /(?:^|\/)cli-context(?:$|\/)/u,
  /(?:^|\/)commands?(?:$|\/)/u,
  /(?:^|\/)presenters?(?:$|\/)/u,
  /(?:^|\/)presentation(?:$|\/)/u,
  /(?:^|\/)release-artifacts?(?:$|\/)/u,
  /(?:^|\/)self(?:$|\/)/u,
  /runtime\/cli-operation-context/u,
  /services\/lifecycle-observations/u,
  /^(?:commander|picocolors|prompts)$/u,
]

describe('Core package boundary', () => {
  it('keeps Core-owned modules free of direct CLI, presentation, self, and release dependencies', async () => {
    const files = await typescriptFiles(CORE_SOURCE)
    const violations: string[] = []

    for (const file of files) {
      const source = await readFile(file, 'utf8')
      for (const specifier of importSpecifiers(source)) {
        if (forbiddenImports.some(pattern => pattern.test(specifier))) {
          violations.push(`${relative(ROOT, file)} -> ${specifier}`)
        }
      }
      if (/\bconsole\s*\./u.test(source)) violations.push(`${relative(ROOT, file)} uses console`)
      if (/\bprocess\s*\.\s*exit\b/u.test(source)) violations.push(`${relative(ROOT, file)} uses process.exit`)
    }

    expect(violations).toEqual([])
  })

  it('publishes one Core source entry and only the supported package subpaths', async () => {
    const entry = await readFile(PACKAGE_ENTRY, 'utf8')
    const manifest = JSON.parse(await readFile(PACKAGE_MANIFEST, 'utf8')) as {
      exports?: Record<string, unknown>
    }

    expect(importSpecifiers(entry)).toEqual(['../../../src/core/index', '../../../src/core/index'])
    expect(Object.keys(manifest.exports ?? {}).sort()).toEqual(['.', './package.json'])
    expect(entry).not.toMatch(/provider|receipt|state|plan|command|presenter|self|release/iu)
  })

  it('keeps the complete public runtime dependency closure outside mutation and CLI infrastructure', async () => {
    const closure = await runtimeDependencyClosure(PACKAGE_ENTRY)
    const allowedOutsideCore = new Set([
      'src/lifecycle/agent-observation.ts',
      'src/lifecycle/provider-binding.ts',
      'src/package-manager/managed-install-types.ts',
      'src/providers/types.ts',
      'src/state/schema.ts',
      'src/utils/compare-versions.ts',
    ])
    const violations = [...closure]
      .map(file => relative(ROOT, file))
      .filter(file => !file.startsWith('src/core/') && file !== 'packages/core/src/index.ts')
      .filter(file => !allowedOutsideCore.has(file))

    expect(violations).toEqual([])
  })
})

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

async function runtimeDependencyClosure(entry: string): Promise<Set<string>> {
  const visited = new Set<string>()
  const pending = [entry]
  while (pending.length > 0) {
    const file = pending.shift()
    if (!file || visited.has(file)) continue
    visited.add(file)
    const source = await readFile(file, 'utf8')
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement)) {
        if (statement.importClause?.isTypeOnly) continue
        const specifier = stringSpecifier(statement.moduleSpecifier)
        if (specifier?.startsWith('.')) pending.push(await resolveTypescriptImport(file, specifier))
      }
      if (ts.isExportDeclaration(statement)) {
        if (statement.isTypeOnly) continue
        const specifier = stringSpecifier(statement.moduleSpecifier)
        if (specifier?.startsWith('.')) pending.push(await resolveTypescriptImport(file, specifier))
      }
    }
  }
  return visited
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
  throw new Error(`Cannot resolve ${specifier} from ${relative(ROOT, importer)}.`)
}
