import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

const rootDir = resolve(import.meta.dir, '../..')
const allowedRootMarkdownFiles = new Set(['AGENTS.md', 'CHANGELOG.md', 'README.en.md', 'README.md', 'README.zh-CN.md'])

const runtimeStubTemplate = 'skills/quantex-agent-runtime/bootstrap-stub.md'
const runtimeStubPaths = [
  '.agents/skills/quantex-agent-runtime/SKILL.md',
  '.codex/skills/quantex-agent-runtime/SKILL.md',
  '.github/skills/quantex-agent-runtime/SKILL.md',
]

const issues: string[] = []

await checkRootMarkdownWhitelist()
await checkRuntimeStubParity()

if (issues.length > 0) {
  console.error('Project memory check failed:\n')
  for (const issue of issues) console.error(`- ${issue}`)

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
      issues.push(
        `unexpected root markdown file "${fileName}". Move it into docs/ or openspec/, or explicitly allowlist it.`,
      )
    }
  }
}

async function checkRuntimeStubParity() {
  const template = await readFile(resolve(rootDir, runtimeStubTemplate), 'utf8')

  for (const stubPath of runtimeStubPaths) {
    let stub: string
    try {
      stub = await readFile(resolve(rootDir, stubPath), 'utf8')
    } catch {
      issues.push(`missing runtime bootstrap stub "${stubPath}". Copy it from ${runtimeStubTemplate}.`)
      continue
    }

    if (stub !== template) {
      issues.push(
        `runtime bootstrap stub "${stubPath}" drifted from ${runtimeStubTemplate}. Resync the file byte-for-byte.`,
      )
    }
  }
}
