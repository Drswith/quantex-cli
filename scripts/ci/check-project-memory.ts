import type { Stats } from 'node:fs'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

const rootDir = resolve(import.meta.dir, '../..')
const allowedRootMarkdownFiles = new Set(['AGENTS.md', 'CHANGELOG.md', 'README.en.md', 'README.md', 'README.zh-CN.md'])

const runtimeStubTemplate = 'skills/quantex-agent-runtime/bootstrap-stub.md'
const runtimeStubPaths = [
  '.agents/skills/quantex-agent-runtime/SKILL.md',
  '.claude/skills/quantex-agent-runtime/SKILL.md',
  '.codex/skills/quantex-agent-runtime/SKILL.md',
  '.github/skills/quantex-agent-runtime/SKILL.md',
]

// AGENTS.md inlines only triggers and points at the runtime skill for the full
// routing detail. A pointer is only worth as much as its target, so verify the
// skill still carries what the handbook stopped restating.
const runtimeSkillPath = 'skills/quantex-agent-runtime/SKILL.md'
const deferredRoutingMarkers = [
  'bun run lint',
  'bun run format:check',
  'bun run typecheck',
  'bun run test',
  'bun run openspec:validate',
  'bun run memory:check',
  'bun run release:dry-run',
]

const issues: string[] = []

await checkRootMarkdownWhitelist()
await checkRuntimeStubParity()
await checkDeferredRoutingDetail()

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
    await checkStubIsRegularFile(stubPath)

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

// A symlinked stub — or a symlinked skill directory above it — reads back as the
// central runtime on a POSIX checkout and as a one-line path on a checkout
// without symlink support, so parity alone would not notice it.
async function checkStubIsRegularFile(stubPath: string) {
  for (const candidate of [stubPath, dirname(stubPath)]) {
    let stats: Stats
    try {
      stats = await lstat(resolve(rootDir, candidate))
    } catch {
      continue
    }

    if (stats.isSymbolicLink()) {
      issues.push(
        `runtime bootstrap path "${candidate}" is a symlink. Agent bootstrap entries must be regular files copied from ${runtimeStubTemplate} so every checkout resolves them identically.`,
      )
    }
  }
}

async function checkDeferredRoutingDetail() {
  let runtimeSkill: string
  try {
    runtimeSkill = await readFile(resolve(rootDir, runtimeSkillPath), 'utf8')
  } catch {
    issues.push(`missing runtime skill "${runtimeSkillPath}", which AGENTS.md defers validation routing to.`)
    return
  }

  const missing = deferredRoutingMarkers.filter(marker => !runtimeSkill.includes(marker))
  if (missing.length > 0) {
    issues.push(
      `runtime skill "${runtimeSkillPath}" no longer documents ${missing.join(', ')}. AGENTS.md points at it for validation routing, so either restore the detail there or stop deferring to it.`,
    )
  }
}
