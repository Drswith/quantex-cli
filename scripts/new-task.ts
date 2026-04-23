import { readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import prompts from 'prompts'
import { defaultTaskChecks, taskHumanReviewValues, taskPriorityValues, taskStatusValues } from './project-memory-schema'
import { getNextSequenceNumber, isInteractiveSession, normalizeListValues, renderFrontmatterList, rootDir, slugify, writeNewFile } from './project-memory-utils'

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'area': { type: 'string' },
    'check': { type: 'string', multiple: true },
    'doc': { type: 'string', multiple: true },
    'depends-on': { type: 'string', multiple: true },
    'help': { type: 'boolean' },
    'human-review': { type: 'string' },
    'id': { type: 'string' },
    'priority': { type: 'string' },
    'queue': { type: 'boolean' },
    'status': { type: 'string' },
    'title': { type: 'string' },
  },
  allowPositionals: false,
})

if (values.help) {
  printHelp()
  process.exit(0)
}

const interactive = isInteractiveSession()
const nextId = values.id ?? formatTaskId(await getNextSequenceNumber(join(rootDir, 'autonomy', 'tasks'), /^qtx-(\d{4})-/))

assertTaskId(nextId)

const promptResults = await collectPromptResults(interactive)
const title = values.title ?? promptResults.title
if (!title) {
  console.error('Missing required task title. Use --title or run the command interactively.')
  process.exit(1)
}

const status = values.status ?? promptResults.status ?? 'planned'
const priority = values.priority ?? promptResults.priority ?? 'medium'
const area = values.area ?? promptResults.area ?? 'docs'
const humanReview = values['human-review'] ?? promptResults.humanReview ?? 'required'
const dependsOn = normalizeListValues(values['depends-on'] ?? promptResults.dependsOn)
const docsToUpdate = normalizeListValues(values.doc ?? promptResults.docsToUpdate)
const checks = normalizeListValues(values.check).length > 0
  ? normalizeListValues(values.check)
  : defaultTaskChecks
const addToQueue = values.queue ?? promptResults.addToQueue ?? false

assertAllowedValue('status', status, taskStatusValues)
assertAllowedValue('priority', priority, taskPriorityValues)
assertAllowedValue('human-review', humanReview, taskHumanReviewValues)

const taskFileName = `${nextId}-${slugify(title, 'task')}.md`
const taskFilePath = join(rootDir, 'autonomy', 'tasks', taskFileName)
const taskRelativePath = `./tasks/${taskFileName}`

await writeNewFile(taskFilePath, renderTaskContent({
  area,
  checks,
  dependsOn,
  docsToUpdate,
  humanReview,
  id: nextId,
  priority,
  status,
  title,
}))

if (addToQueue)
  await appendTaskToQueue({ dependsOn, id: nextId, priority, relativePath: taskRelativePath, status, title })

console.log(`Created task: ${relative(rootDir, taskFilePath)}`)
if (addToQueue)
  console.log('Updated autonomy/queue.md')

async function collectPromptResults(enabled: boolean) {
  if (!enabled)
    return {}

  const response = await prompts([
    {
      type: values.title ? null : 'text',
      name: 'title',
      message: 'Task title',
      validate: input => input.trim().length > 0 ? true : 'Title is required',
    },
    {
      type: values.status ? null : 'select',
      name: 'status',
      message: 'Task status',
      choices: taskStatusValues.map(value => ({ title: value, value })),
      initial: taskStatusValues.indexOf('planned'),
    },
    {
      type: values.priority ? null : 'select',
      name: 'priority',
      message: 'Task priority',
      choices: taskPriorityValues.map(value => ({ title: value, value })),
      initial: taskPriorityValues.indexOf('medium'),
    },
    {
      type: values.area ? null : 'text',
      name: 'area',
      message: 'Task area',
      initial: 'docs',
    },
    {
      type: values['human-review'] ? null : 'select',
      name: 'humanReview',
      message: 'Human review mode',
      choices: taskHumanReviewValues.map(value => ({ title: value, value })),
      initial: taskHumanReviewValues.indexOf('required'),
    },
    {
      type: values['depends-on'] ? null : 'text',
      name: 'dependsOn',
      message: 'Dependencies (comma separated task ids)',
    },
    {
      type: values.doc ? null : 'text',
      name: 'docsToUpdate',
      message: 'Docs to update (comma separated paths)',
    },
    {
      type: typeof values.queue === 'boolean' ? null : 'confirm',
      name: 'addToQueue',
      message: 'Add task to autonomy/queue.md?',
      initial: true,
    },
  ], {
    onCancel: () => {
      console.error('Cancelled.')
      process.exit(1)
    },
  })

  return response as {
    addToQueue?: boolean
    area?: string
    dependsOn?: string
    docsToUpdate?: string
    humanReview?: string
    priority?: string
    status?: string
    title?: string
  }
}

function renderTaskContent(input: {
  area: string
  checks: string[]
  dependsOn: string[]
  docsToUpdate: string[]
  humanReview: string
  id: string
  priority: string
  status: string
  title: string
}) {
  return [
    '---',
    `id: ${input.id}`,
    `title: ${input.title}`,
    `status: ${input.status}`,
    `priority: ${input.priority}`,
    `area: ${input.area}`,
    renderFrontmatterList('depends_on', input.dependsOn),
    `human_review: ${input.humanReview}`,
    renderFrontmatterList('checks', input.checks),
    renderFrontmatterList('docs_to_update', input.docsToUpdate),
    '---',
    '',
    `# Task: ${input.title}`,
    '',
    '## Goal',
    '',
    'What should be true when this task is complete?',
    '',
    '## Context',
    '',
    'Why does this task matter?',
    '',
    '## Constraints',
    '',
    '- Scope boundary',
    '- Safety boundary',
    '',
    '## Implementation Notes',
    '',
    '- Relevant files',
    '- Relevant commands',
    '- Relevant specs or ADRs',
    '',
    '## Done When',
    '',
    '- Outcome A',
    '- Outcome B',
    '',
    '## Non-Goals',
    '',
    '- Explicitly excluded work',
  ].join('\n')
}

async function appendTaskToQueue(input: {
  dependsOn: string[]
  id: string
  priority: string
  relativePath: string
  status: string
  title: string
}) {
  const queuePath = join(rootDir, 'autonomy', 'queue.md')
  const queueContent = await readFile(queuePath, 'utf8')
  if (queueContent.includes(`[${input.id}](`))
    throw new Error(`Task ${input.id} is already referenced in autonomy/queue.md`)

  const dependsOnCell = input.dependsOn.length > 0 ? input.dependsOn.join(', ') : '-'
  const row = `| [${input.id}](${input.relativePath}) | \`${input.status}\` | \`${input.priority}\` | ${input.title} | ${dependsOnCell} |`
  const updatedQueue = queueContent.includes('\n\n## Intake rules')
    ? queueContent.replace('\n\n## Intake rules', `\n${row}\n\n## Intake rules`)
    : `${queueContent.trimEnd()}\n${row}\n`

  await writeFile(queuePath, updatedQueue, 'utf8')
}

function formatTaskId(sequenceNumber: number) {
  return `qtx-${String(sequenceNumber).padStart(4, '0')}`
}

function assertAllowedValue(name: string, value: string, allowedValues: readonly string[]) {
  if (allowedValues.includes(value))
    return

  console.error(`Invalid ${name}: "${value}". Allowed values: ${allowedValues.join(', ')}`)
  process.exit(1)
}

function assertTaskId(taskId: string) {
  if (/^qtx-\d{4}$/.test(taskId))
    return

  console.error(`Invalid task id: "${taskId}". Expected format "qtx-0000".`)
  process.exit(1)
}

function printHelp() {
  console.log(`
Create a new autonomy task scaffold.

Usage:
  bun run task:new -- --title "Task title"

Options:
  --id <qtx-0000>
  --title <title>
  --status <${taskStatusValues.join('|')}>
  --priority <${taskPriorityValues.join('|')}>
  --area <area>
  --human-review <${taskHumanReviewValues.join('|')}>
  --depends-on <task-id>    Repeatable or comma separated
  --doc <path>              Repeatable or comma separated
  --check <command>         Repeatable or comma separated
  --queue                   Add the task to autonomy/queue.md
  --help
`.trim())
}
