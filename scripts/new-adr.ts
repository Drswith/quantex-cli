import { join, relative } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import prompts from 'prompts'
import { formatCurrentDate, getNextSequenceNumber, isInteractiveSession, rootDir, slugify, writeNewFile } from './project-memory-utils'

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    date: { type: 'string' },
    help: { type: 'boolean' },
    number: { type: 'string' },
    status: { type: 'string' },
    title: { type: 'string' },
  },
  allowPositionals: false,
})

if (values.help) {
  printHelp()
  process.exit(0)
}

const interactive = isInteractiveSession()
const nextNumber = values.number ?? formatAdrNumber(await getNextSequenceNumber(join(rootDir, 'docs', 'adr'), /^(\d{4})-/))
assertAdrNumber(nextNumber)

const promptResults = await collectPromptResults(interactive)
const title = values.title ?? promptResults.title
if (!title) {
  console.error('Missing required ADR title. Use --title or run the command interactively.')
  process.exit(1)
}

const status = values.status ?? promptResults.status ?? 'Proposed'
const date = values.date ?? promptResults.date ?? formatCurrentDate()
assertDate(date)

const fileName = `${nextNumber}-${slugify(title, 'decision')}.md`
const filePath = join(rootDir, 'docs', 'adr', fileName)

await writeNewFile(filePath, [
  `# ADR ${nextNumber}: ${title}`,
  '',
  `- Status: ${status}`,
  `- Date: ${date}`,
  '',
  '## Context',
  '',
  'What problem, pressure, or constraint led to this decision?',
  '',
  '## Decision',
  '',
  'What are we choosing?',
  '',
  '## Consequences',
  '',
  'What becomes easier, harder, safer, or more constrained because of this decision?',
  '',
  '## Alternatives Considered',
  '',
  '- Alternative A',
  '- Alternative B',
  '',
  '## Follow-up',
  '',
  '- What specs, tasks, or runbooks should change because of this decision?',
].join('\n'))

console.log(`Created ADR: ${relative(rootDir, filePath)}`)

async function collectPromptResults(enabled: boolean) {
  if (!enabled)
    return {}

  const response = await prompts([
    {
      type: values.title ? null : 'text',
      name: 'title',
      message: 'ADR title',
      validate: input => input.trim().length > 0 ? true : 'Title is required',
    },
    {
      type: values.status ? null : 'text',
      name: 'status',
      message: 'ADR status',
      initial: 'Proposed',
    },
    {
      type: values.date ? null : 'text',
      name: 'date',
      message: 'ADR date',
      initial: formatCurrentDate(),
      validate: input => /^\d{4}-\d{2}-\d{2}$/.test(input) ? true : 'Use YYYY-MM-DD',
    },
  ], {
    onCancel: () => {
      console.error('Cancelled.')
      process.exit(1)
    },
  })

  return response as {
    date?: string
    status?: string
    title?: string
  }
}

function formatAdrNumber(sequenceNumber: number) {
  return String(sequenceNumber).padStart(4, '0')
}

function assertAdrNumber(value: string) {
  if (/^\d{4}$/.test(value))
    return

  console.error(`Invalid ADR number: "${value}". Expected format "0000".`)
  process.exit(1)
}

function assertDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return

  console.error(`Invalid ADR date: "${value}". Expected format "YYYY-MM-DD".`)
  process.exit(1)
}

function printHelp() {
  console.log(`
Create a new ADR scaffold.

Usage:
  bun run adr:new -- --title "Decision title"

Options:
  --number <0000>
  --title <title>
  --status <status>
  --date <YYYY-MM-DD>
  --help
`.trim())
}
