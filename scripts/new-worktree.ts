import { spawnSync } from 'node:child_process'
import { basename, relative, resolve } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import prompts from 'prompts'
import { isInteractiveSession, rootDir, slugify } from './project-memory-utils'

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    base: { type: 'string' },
    branch: { type: 'string' },
    help: { type: 'boolean' },
    path: { type: 'string' },
    task: { type: 'string' },
    title: { type: 'string' },
  },
  allowPositionals: false,
})

if (values.help) {
  printHelp()
  process.exit(0)
}

const interactive = isInteractiveSession()
const promptResults = await collectPromptResults(interactive)

const task = values.task ?? promptResults.task ?? ''
const title = values.title ?? promptResults.title ?? ''
const base = values.base ?? promptResults.base ?? 'main'
const slug = slugify([task, title].filter(Boolean).join(' '), 'task')
const branch = values.branch ?? `codex/${slug}`
const worktreePath = resolve(values.path ?? resolve(rootDir, '..', `${basename(rootDir)}-${slug}`))

assertGitRefExists(base)
assertBranchDoesNotExist(branch)

const addResult = spawnSync('git', ['worktree', 'add', worktreePath, '-b', branch, base], {
  cwd: rootDir,
  stdio: 'inherit',
})

if (addResult.status !== 0)
  process.exit(addResult.status ?? 1)

const relativeWorktreePath = relative(rootDir, worktreePath) || '.'

console.log(`Created worktree: ${relativeWorktreePath}`)
console.log(`Branch: ${branch}`)
console.log(`Base: ${base}`)
console.log('Next steps:')
console.log(`  cd ${worktreePath}`)
console.log('  git status --short --branch')

async function collectPromptResults(enabled: boolean) {
  if (!enabled)
    return {}

  const response = await prompts([
    {
      type: values.task ? null : 'text',
      name: 'task',
      message: 'Task id (optional)',
      initial: '',
    },
    {
      type: values.title || values.branch ? null : 'text',
      name: 'title',
      message: 'Short worktree title',
      validate: input => input.trim().length > 0 ? true : 'Title is required unless --branch is provided',
    },
    {
      type: values.base ? null : 'text',
      name: 'base',
      message: 'Base branch or ref',
      initial: 'main',
      validate: input => input.trim().length > 0 ? true : 'Base ref is required',
    },
  ], {
    onCancel: () => {
      console.error('Cancelled.')
      process.exit(1)
    },
  })

  return response as {
    base?: string
    task?: string
    title?: string
  }
}

function assertGitRefExists(ref: string) {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
    cwd: rootDir,
    stdio: 'ignore',
  })

  if (result.status === 0)
    return

  console.error(`Unknown base ref: "${ref}".`)
  process.exit(1)
}

function assertBranchDoesNotExist(branch: string) {
  const result = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
    cwd: rootDir,
    stdio: 'ignore',
  })

  if (result.status !== 0)
    return

  console.error(`Branch already exists locally: "${branch}". Choose another branch or attach a worktree manually.`)
  process.exit(1)
}

function printHelp() {
  console.log(`
Create a dedicated git worktree for a task branch.

Usage:
  bun run worktree:new -- --task qtx-0000 --title "Task title"

Options:
  --task <qtx-0000>
  --title <title>
  --branch <branch-name>
  --base <ref>
  --path <worktree-path>
  --help

Defaults:
  branch: codex/<task-and-title-slug>
  base: main
  path: ../<repo-name>-<task-and-title-slug>
`.trim())
}
