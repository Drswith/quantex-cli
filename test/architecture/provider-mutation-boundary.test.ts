import { readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const INSTALL_EFFECT_PROVIDER = join(ROOT, 'src', 'providers', 'adapters', 'install-effect.ts')
const PROVIDER_MUTATION_MODULES = [
  'src/package-manager/brew.ts',
  'src/package-manager/bun.ts',
  'src/package-manager/cargo.ts',
  'src/package-manager/deno.ts',
  'src/package-manager/mise.ts',
  'src/package-manager/npm.ts',
  'src/package-manager/pip.ts',
  'src/package-manager/uv.ts',
  'src/package-manager/winget.ts',
  'src/providers/adapters/install-effect.ts',
] as const
const CLI_GLOBAL_MODULES = new Set([
  'src/cli-context.ts',
  'src/runtime/cli-operation-context.ts',
  'src/utils/cli-child-process.ts',
])

describe('provider mutation process boundary', () => {
  it('keeps the typed install-effect runtime dependencies free of CLI-global process context', async () => {
    const closure = await runtimeDependencyClosure(INSTALL_EFFECT_PROVIDER)
    const paths = [...closure].map(repositoryPath)

    expect(paths).toContain('src/package-manager/context-mutation.ts')
    expect(paths).toContain('src/utils/child-process.ts')
    expect(paths.filter(path => CLI_GLOBAL_MODULES.has(path))).toEqual([])
  })

  it('keeps every provider mutation module on the context-native static dependency path', async () => {
    const violations: string[] = []
    for (const entry of PROVIDER_MUTATION_MODULES) {
      const closure = await runtimeDependencyClosure(join(ROOT, ...entry.split('/')))
      for (const dependency of [...closure].map(repositoryPath)) {
        if (CLI_GLOBAL_MODULES.has(dependency)) violations.push(`${entry} -> ${dependency}`)
      }
    }

    expect(violations).toEqual([])
  })
})

function repositoryPath(file: string): string {
  return relative(ROOT, file).replaceAll('\\', '/')
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
  throw new Error(`Cannot resolve ${specifier} from ${repositoryPath(importer)}.`)
}
