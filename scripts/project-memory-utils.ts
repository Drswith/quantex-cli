import { access, mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))

export const rootDir = resolve(scriptDir, '..')

export function formatCurrentDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(new Date())
}

export async function getNextSequenceNumber(directoryPath: string, pattern: RegExp) {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  let max = 0

  for (const entry of entries) {
    if (!entry.isFile())
      continue

    const match = entry.name.match(pattern)
    if (!match)
      continue

    const value = Number.parseInt(match[1], 10)
    if (Number.isFinite(value))
      max = Math.max(max, value)
  }

  return max + 1
}

export function isInteractiveSession() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

export function normalizeListValues(values: string | string[] | undefined) {
  const rawValues = Array.isArray(values)
    ? values
    : values
      ? [values]
      : []

  return [...new Set(
    rawValues
      .flatMap(value => value.split(','))
      .map(value => value.trim())
      .filter(Boolean),
  )]
}

export function renderFrontmatterList(key: string, values: string[]) {
  if (values.length === 0)
    return `${key}: []`

  return [
    `${key}:`,
    ...values.map(value => `  - ${value}`),
  ].join('\n')
}

export function slugify(value: string, fallback = 'item') {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')

  return normalized || fallback
}

export function insertQueueRow(queueContent: string, row: string, status: string) {
  const activeHeader = '## Active queue'
  const completedHeader = '## Completed milestones'
  const intakeHeader = '## Intake rules'
  const tableDivider = '|---|---|---|---|---|'
  const emptyActiveNotice = 'No active tasks are currently queued. Add the next executable task contract in `autonomy/tasks/` before reopening this section.'

  const normalizedQueue = queueContent.replace(`${emptyActiveNotice}\n\n`, '')
  const targetHeader = status === 'done' ? completedHeader : activeHeader
  const fallbackHeader = status === 'done' ? intakeHeader : completedHeader
  const sectionStart = normalizedQueue.indexOf(targetHeader)
  const sectionEnd = normalizedQueue.indexOf(fallbackHeader)

  if (sectionStart === -1 || sectionEnd === -1 || sectionEnd <= sectionStart)
    return `${normalizedQueue.trimEnd()}\n${row}\n`

  const beforeSection = normalizedQueue.slice(0, sectionStart)
  const section = normalizedQueue.slice(sectionStart, sectionEnd)
  const afterSection = normalizedQueue.slice(sectionEnd)
  const dividerIndex = section.indexOf(tableDivider)

  if (dividerIndex === -1)
    return `${normalizedQueue.trimEnd()}\n${row}\n`

  const dividerEnd = dividerIndex + tableDivider.length
  const sectionWithRow = `${section.slice(0, dividerEnd)}\n${row}${section.slice(dividerEnd)}`
  return `${beforeSection}${sectionWithRow}${afterSection}`
}

export async function writeNewFile(filePath: string, content: string) {
  try {
    await access(filePath)
    throw new Error(`File already exists: ${filePath}`)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
  }

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${content.trimEnd()}\n`, 'utf8')
}
