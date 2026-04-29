import { readFileSync } from 'node:fs'
import process from 'node:process'
import { classifyChangedFiles } from './path-taxonomy'

export interface PrBodyPolicyInput {
  body: string
  changedFiles?: string[]
  headBranch?: string
  title?: string
}

export const requiredPrBodyHeadings = [
  '## Summary',
  '## Linked Artifacts',
  '## Validation',
  '## Release Intent',
  '## Docs Updated',
  '## Scope Check',
  '## Closure Check',
] as const

const placeholderValues = new Set(['', 'n/a', 'none', 'not applicable', 'tbd', '(none)'])

export function validatePrBodyPolicy(input: PrBodyPolicyInput): string[] {
  const body = input.body || ''
  const headBranch = input.headBranch || ''
  const title = input.title || ''
  const issues: string[] = []

  const missingHeadings = requiredPrBodyHeadings.filter(heading => !body.includes(heading))
  if (missingHeadings.length > 0) {
    issues.push(`PR body is missing required sections: ${missingHeadings.join(', ')}`)
    return issues
  }

  const linkedArtifacts = extractSectionValues(body, 'Linked Artifacts')
  const meaningfulArtifacts = linkedArtifacts.filter(value => !placeholderValues.has(value.toLowerCase()))

  if (meaningfulArtifacts.length === 0) {
    issues.push(
      'PR body must link at least one issue, ADR, OpenSpec artifact, or discussion in the "Linked Artifacts" section.',
    )
  }

  if (!input.changedFiles || input.changedFiles.length === 0) return issues

  const classification = classifyChangedFiles(input.changedFiles)
  const releaseWorthyMetadata = hasReleaseWorthyMetadata(title, body)

  if (classification.processOnly && releaseWorthyMetadata) {
    issues.push(
      [
        'Release/process/docs/memory-only PRs must not use release-worthy conventional commit metadata.',
        'Use ci:, chore:, or docs: unless the PR changes user-facing product behavior.',
        `Changed files: ${classification.changedFiles.join(', ')}`,
      ].join('\n'),
    )
  }

  const releasePleaseBranch = headBranch.startsWith('release-please--branches--')

  if (
    classification.productImpacting &&
    !releasePleaseBranch &&
    !releaseWorthyMetadata &&
    !hasMeaningfulNoReleaseReason(body)
  ) {
    issues.push(
      [
        'Product-impacting PRs must not silently skip release automation.',
        'Use a release-worthy PR title such as feat:, fix:, perf:, or type!: when the change should release.',
        'If no release is needed, add a meaningful line under "## Release Intent":',
        'Release: not applicable - <reason>',
        `Product-impacting files: ${classification.productImpactingFiles.join(', ')}`,
      ].join('\n'),
    )
  }

  return issues
}

export function hasReleaseWorthyMetadata(title: string, body: string): boolean {
  return (
    /^(feat|fix|perf)(\(.+\))?!?:/.test(title) ||
    /^[a-z]+(\(.+\))?!:/.test(title) ||
    /\nBREAKING CHANGE:/.test(`\n${body}`)
  )
}

function hasMeaningfulNoReleaseReason(body: string): boolean {
  const releaseIntent = extractSection(body, 'Release Intent')
  const notApplicableMatch = releaseIntent.match(/release\s*:\s*not applicable\s*[-:]\s*(.+)/i)
  const reason = notApplicableMatch ? notApplicableMatch[1].trim() : ''

  return notApplicableMatch !== null && !placeholderValues.has(reason.toLowerCase())
}

function extractSectionValues(body: string, heading: string): string[] {
  return extractSection(body, heading)
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => {
      const separatorIndex = line.indexOf(':')
      return separatorIndex === -1 ? '' : line.slice(separatorIndex + 1).trim()
    })
    .filter(Boolean)
}

function extractSection(body: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match =
    body.match(new RegExp(`## ${escapedHeading}\\s*([\\s\\S]*?)\\n## `)) ??
    body.match(new RegExp(`## ${escapedHeading}\\s*([\\s\\S]*)$`))

  return match ? match[1].trim() : ''
}

if (import.meta.main) {
  const options = parseArgs(process.argv.slice(2))
  const body = options.bodyFile ? readFileSync(options.bodyFile, 'utf8') : process.env.PR_BODY || ''
  const title = options.title ?? process.env.PR_TITLE ?? ''
  const headBranch = options.headBranch ?? process.env.PR_HEAD_BRANCH ?? ''
  const changedFiles = options.changedFilesJson
    ? parseChangedFiles(options.changedFilesJson)
    : process.env.CHANGED_FILES_JSON
      ? parseChangedFiles(process.env.CHANGED_FILES_JSON)
      : undefined

  const issues = validatePrBodyPolicy({ body, changedFiles, headBranch, title })

  if (issues.length > 0) {
    console.error('PR body policy check failed:\n')
    for (const issue of issues) console.error(`- ${issue}`)
    process.exit(1)
  }

  console.log('PR body policy check passed.')
}

function parseArgs(args: string[]): {
  bodyFile?: string
  changedFilesJson?: string
  headBranch?: string
  title?: string
} {
  const options: {
    bodyFile?: string
    changedFilesJson?: string
    headBranch?: string
    title?: string
  } = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const nextValue = args[index + 1]

    if (arg === '--body-file' && nextValue) {
      options.bodyFile = nextValue
      index += 1
    } else if (arg === '--changed-files-json' && nextValue) {
      options.changedFilesJson = nextValue
      index += 1
    } else if (arg === '--head-branch' && nextValue) {
      options.headBranch = nextValue
      index += 1
    } else if (arg === '--title' && nextValue) {
      options.title = nextValue
      index += 1
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`)
    }
  }

  return options
}

function parseChangedFiles(rawValue: string): string[] {
  const parsedValue = JSON.parse(rawValue)
  if (!Array.isArray(parsedValue) || parsedValue.some(value => typeof value !== 'string')) {
    throw new Error('Changed files must be a JSON array of file paths.')
  }

  return parsedValue
}
