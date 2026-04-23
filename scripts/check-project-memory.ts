import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { taskHumanReviewValues, taskPriorityValues, taskStatusValues } from './project-memory-schema'

type FrontmatterValue = string | string[]

interface TaskFrontmatter {
  id: string
  title: string
  status: string
  priority: string
  area: string
  depends_on: string[]
  human_review: string
  checks: string[]
  docs_to_update: string[]
}

interface TaskRecord {
  filePath: string
  fileName: string
  frontmatter: TaskFrontmatter
}

interface QueueEntry {
  id: string
  relativePath: string
  status: string
  priority: string
  title: string
  dependsOn: string
}

const rootDir = resolve(import.meta.dir, '..')
const allowedRootMarkdownFiles = new Set([
  'AGENTS.md',
  'CHANGELOG.md',
  'README.md',
])

const requiredTaskKeys = [
  'id',
  'title',
  'status',
  'priority',
  'area',
  'depends_on',
  'human_review',
  'checks',
  'docs_to_update',
] as const

const allowedTaskStatuses = new Set<string>(taskStatusValues)
const allowedTaskPriorities = new Set<string>(taskPriorityValues)
const allowedHumanReviewModes = new Set<string>(taskHumanReviewValues)

const issues: string[] = []

await checkRootMarkdownWhitelist()
const tasks = await loadTasks()
checkTaskDependencies(tasks)
await checkQueue(tasks)

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
      issues.push(`unexpected root markdown file "${fileName}". Move it into docs/, autonomy/, or openspec/, or explicitly allowlist it during migration.`)
    }
  }
}

async function loadTasks() {
  const tasksDir = join(rootDir, 'autonomy', 'tasks')
  const taskEntries = await readdir(tasksDir, { withFileTypes: true })
  const tasks = new Map<string, TaskRecord>()

  for (const entry of taskEntries) {
    if (!entry.isFile())
      continue
    if (!entry.name.endsWith('.md'))
      continue
    if (entry.name === 'README.md' || entry.name === '_template.md')
      continue

    const filePath = join(tasksDir, entry.name)
    const content = await readFile(filePath, 'utf8')
    const frontmatter = parseTaskFrontmatter(content, entry.name)
    if (!frontmatter)
      continue

    const task: TaskRecord = {
      filePath,
      fileName: entry.name,
      frontmatter,
    }

    validateTask(task)

    if (tasks.has(frontmatter.id)) {
      issues.push(`duplicate task id "${frontmatter.id}" found in "${entry.name}" and "${tasks.get(frontmatter.id)?.fileName}".`)
      continue
    }

    tasks.set(frontmatter.id, task)
  }

  return tasks
}

function validateTask(task: TaskRecord) {
  const { fileName, frontmatter } = task

  for (const key of requiredTaskKeys) {
    if (!(key in frontmatter))
      issues.push(`task "${fileName}" is missing required frontmatter key "${key}".`)
  }

  if (!/^qtx-\d{4}$/.test(frontmatter.id))
    issues.push(`task "${fileName}" has invalid id "${frontmatter.id}". Expected format "qtx-0000".`)

  if (!fileName.startsWith(`${frontmatter.id}-`))
    issues.push(`task "${fileName}" should start with "${frontmatter.id}-" to match its frontmatter id.`)

  if (!frontmatter.title.trim())
    issues.push(`task "${fileName}" must have a non-empty title.`)

  if (!allowedTaskStatuses.has(frontmatter.status))
    issues.push(`task "${fileName}" has unsupported status "${frontmatter.status}".`)

  if (!allowedTaskPriorities.has(frontmatter.priority))
    issues.push(`task "${fileName}" has unsupported priority "${frontmatter.priority}".`)

  if (!allowedHumanReviewModes.has(frontmatter.human_review))
    issues.push(`task "${fileName}" has unsupported human_review value "${frontmatter.human_review}".`)

  if (!Array.isArray(frontmatter.depends_on))
    issues.push(`task "${fileName}" must declare depends_on as an array.`)

  if (!Array.isArray(frontmatter.checks))
    issues.push(`task "${fileName}" must declare checks as an array.`)

  if (!Array.isArray(frontmatter.docs_to_update))
    issues.push(`task "${fileName}" must declare docs_to_update as an array.`)
}

function checkTaskDependencies(tasks: Map<string, TaskRecord>) {
  for (const task of tasks.values()) {
    for (const dependencyId of task.frontmatter.depends_on) {
      if (!tasks.has(dependencyId)) {
        issues.push(`task "${task.fileName}" depends on missing task "${dependencyId}".`)
      }
    }
  }
}

async function checkQueue(tasks: Map<string, TaskRecord>) {
  const queuePath = join(rootDir, 'autonomy', 'queue.md')
  const queueContent = await readFile(queuePath, 'utf8')
  const queueEntries = parseQueueEntries(queueContent)

  for (const entry of queueEntries) {
    const task = tasks.get(entry.id)
    const absoluteTaskPath = resolve(join(rootDir, 'autonomy'), entry.relativePath)

    if (!task) {
      issues.push(`queue references unknown task "${entry.id}".`)
      continue
    }

    if (task.filePath !== absoluteTaskPath) {
      issues.push(`queue entry "${entry.id}" points to "${entry.relativePath}", but the canonical task file is "${relativeToRoot(task.filePath)}".`)
    }

    if (entry.status !== task.frontmatter.status) {
      issues.push(`queue entry "${entry.id}" has status "${entry.status}", but task frontmatter says "${task.frontmatter.status}".`)
    }

    if (entry.priority !== task.frontmatter.priority) {
      issues.push(`queue entry "${entry.id}" has priority "${entry.priority}", but task frontmatter says "${task.frontmatter.priority}".`)
    }

    if (entry.title !== task.frontmatter.title) {
      issues.push(`queue entry "${entry.id}" title does not match task frontmatter title.`)
    }

    const renderedDependsOn = task.frontmatter.depends_on.length > 0
      ? task.frontmatter.depends_on.join(', ')
      : '-'

    if (entry.dependsOn !== renderedDependsOn) {
      issues.push(`queue entry "${entry.id}" has depends-on column "${entry.dependsOn}", but task frontmatter renders to "${renderedDependsOn}".`)
    }
  }
}

function parseTaskFrontmatter(content: string, fileName: string): TaskFrontmatter | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (!frontmatterMatch) {
    issues.push(`task "${fileName}" is missing YAML frontmatter.`)
    return null
  }

  const parsed = parseSimpleFrontmatter(frontmatterMatch[1], fileName)
  if (!parsed)
    return null

  return {
    id: readStringField(parsed, 'id', fileName),
    title: readStringField(parsed, 'title', fileName),
    status: readStringField(parsed, 'status', fileName),
    priority: readStringField(parsed, 'priority', fileName),
    area: readStringField(parsed, 'area', fileName),
    depends_on: readArrayField(parsed, 'depends_on', fileName),
    human_review: readStringField(parsed, 'human_review', fileName),
    checks: readArrayField(parsed, 'checks', fileName),
    docs_to_update: readArrayField(parsed, 'docs_to_update', fileName),
  }
}

function parseSimpleFrontmatter(frontmatter: string, fileName: string) {
  const result: Record<string, FrontmatterValue> = {}
  const lines = frontmatter.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.trim())
      continue

    const separatorIndex = line.indexOf(':')
    if (separatorIndex <= 0) {
      issues.push(`task "${fileName}" has an unsupported frontmatter line "${line}".`)
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()

    if (value === '[]') {
      result[key] = []
      continue
    }

    if (value.length > 0) {
      result[key] = value
      continue
    }

    const listValues: string[] = []
    let nextIndex = index + 1

    while (nextIndex < lines.length) {
      const nextLine = lines[nextIndex]
      if (!nextLine.trim())
        break
      if (!nextLine.startsWith('  - '))
        break
      listValues.push(nextLine.slice(4).trim())
      nextIndex += 1
    }

    result[key] = listValues
    index = nextIndex - 1
  }

  return result
}

function readStringField(frontmatter: Record<string, FrontmatterValue>, key: string, fileName: string) {
  const value = frontmatter[key]
  if (typeof value !== 'string') {
    issues.push(`task "${fileName}" must declare "${key}" as a string.`)
    return ''
  }
  return value
}

function readArrayField(frontmatter: Record<string, FrontmatterValue>, key: string, fileName: string) {
  const value = frontmatter[key]
  if (!Array.isArray(value)) {
    issues.push(`task "${fileName}" must declare "${key}" as an array.`)
    return []
  }
  return value
}

function parseQueueEntries(content: string) {
  const entries: QueueEntry[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    if (!line.startsWith('| [qtx-'))
      continue

    const cells = line.split('|').slice(1, -1).map(cell => cell.trim())
    if (cells.length < 5) {
      issues.push(`queue row has an unexpected format: "${line}".`)
      continue
    }

    const linkMatch = cells[0].match(/^\[(qtx-\d{4})\]\(([^)]+)\)$/)
    if (!linkMatch) {
      issues.push(`queue row has an invalid task link cell "${cells[0]}".`)
      continue
    }

    entries.push({
      id: linkMatch[1],
      relativePath: linkMatch[2],
      status: unwrapCode(cells[1]),
      priority: unwrapCode(cells[2]),
      title: cells[3],
      dependsOn: cells[4],
    })
  }

  return entries
}

function unwrapCode(value: string) {
  const match = value.match(/^`(.+)`$/)
  return match ? match[1] : value
}

function relativeToRoot(filePath: string) {
  return filePath.replace(`${rootDir}/`, '')
}
