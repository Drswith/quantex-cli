import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

interface OpenSpecListChange {
  name: string
  status: string
}

interface OpenSpecListResult {
  changes?: OpenSpecListChange[]
}

interface ArchiveSummary {
  archivedChanges: string[]
  archivedCount: number
}

interface CheckSummary {
  changes: string[]
  count: number
}

const mode = process.argv[2]

if (mode !== '--check' && mode !== '--archive') {
  console.error('Usage: bun run scripts/archive-completed-openspec-changes.ts <--check|--archive>')
  process.exit(1)
}

const openspecBinary = join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'openspec.cmd' : 'openspec',
)

function runOpenSpec(args: string[]): string {
  const proc = Bun.spawnSync([openspecBinary, ...args], {
    cwd: process.cwd(),
    stderr: 'pipe',
    stdout: 'pipe',
  })

  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr).trim()
    throw new Error(stderr || `openspec ${args.join(' ')} failed with exit code ${proc.exitCode}`)
  }

  return new TextDecoder().decode(proc.stdout).trim()
}

function getCompletedChanges(): string[] {
  const output = runOpenSpec(['list', '--json'])
  const parsed = JSON.parse(output) as OpenSpecListResult
  return (parsed.changes ?? [])
    .filter(change => change.status === 'complete')
    .map(change => change.name)
    .sort()
}

function printJson(value: CheckSummary | ArchiveSummary): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

function normalizeMarkdownEof(rootDir: string): void {
  const glob = new Bun.Glob('**/*.md')

  for (const relativePath of glob.scanSync({ cwd: rootDir })) {
    const filePath = join(rootDir, relativePath)
    const contents = readFileSync(filePath, 'utf8')
    const normalized = contents.replace(/\n+$/u, '\n')

    if (normalized !== contents) writeFileSync(filePath, normalized)
  }
}

if (mode === '--check') {
  const changes = getCompletedChanges()
  printJson({
    changes,
    count: changes.length,
  })
  process.exit(0)
}

const archivedChanges = getCompletedChanges()

for (const changeName of archivedChanges) runOpenSpec(['archive', '--yes', changeName])

normalizeMarkdownEof(join(process.cwd(), 'openspec'))

printJson({
  archivedChanges,
  archivedCount: archivedChanges.length,
})
