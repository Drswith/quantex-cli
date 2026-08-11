import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SOURCE_ROOT = join(ROOT, 'src')

describe('application runtime boundaries', () => {
  it('keeps application source independent of the process-wide Bun global', async () => {
    const violations: string[] = []
    for (const file of await typescriptFiles(SOURCE_ROOT)) {
      const source = await readFile(file, 'utf8')
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      visit(sourceFile, node => {
        if (!ts.isIdentifier(node) || node.text !== 'Bun') return
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        violations.push(`${repositoryPath(file)}:${line + 1}:${character + 1}`)
      })
    }

    expect(violations).toEqual([])
  })
})

function repositoryPath(file: string): string {
  return relative(ROOT, file).replaceAll('\\', '/')
}

async function typescriptFiles(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await typescriptFiles(path)))
    else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(path)
  }
  return files.sort()
}

function visit(node: ts.Node, callback: (node: ts.Node) => void): void {
  callback(node)
  node.forEachChild(child => visit(child, callback))
}
