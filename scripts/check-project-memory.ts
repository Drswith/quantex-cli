import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

const rootDir = resolve(import.meta.dir, '..')
const allowedRootMarkdownFiles = new Set([
  'AGENTS.md',
  'CHANGELOG.md',
  'README.en.md',
  'README.md',
])

const issues: string[] = []

await checkRootMarkdownWhitelist()

if (issues.length > 0) {
  console.error('Project memory check failed:\n')
  for (const issue of issues)
    console.error(`- ${issue}`)

  process.exit(1)
}

console.log('Project memory check passed.')

async function checkRootMarkdownWhitelist() {
  const rootEntries = await readdir(rootDir, { withFileTypes: true })
  const rootMarkdownFiles = rootEntries
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => entry.name)
    .sort()

  for (const fileName of rootMarkdownFiles) {
    if (!allowedRootMarkdownFiles.has(fileName)) {
      issues.push(`unexpected root markdown file "${fileName}". Move it into docs/ or openspec/, or explicitly allowlist it.`)
    }
  }
}
