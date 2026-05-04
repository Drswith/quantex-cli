import { readFileSync } from 'node:fs'
import process from 'node:process'

const stableTitlePattern = /^chore: release (\d+\.\d+\.\d+)$/
const betaTitlePattern = /^chore: release (\d+\.\d+\.\d+-beta(?:\.\d+)?)$/
const generatedMarker = 'This PR was generated with [Release Please]'

const allowedFiles = new Set([
  '.release-please-manifest.json',
  'CHANGELOG.md',
  'package.json',
  'src/generated/build-meta.ts',
])

const requiredFiles = new Set(['.release-please-manifest.json', 'package.json', 'src/generated/build-meta.ts'])

export function validateReleasePrPolicy(input) {
  const issues = []
  const baseBranch = input.baseBranch || ''
  const headBranch = input.headBranch || ''
  const title = input.title || ''
  const body = input.body || ''
  const changedFiles = [...(input.changedFiles || [])].sort()
  const baseVersion = input.baseVersion || ''

  const expectedHeadBranch = `release-please--branches--${baseBranch}--components--quantex-cli`
  if (headBranch !== expectedHeadBranch) {
    issues.push(`Unexpected release-please branch "${headBranch}". Expected "${expectedHeadBranch}".`)
  }

  const titlePattern = baseBranch === 'beta' ? betaTitlePattern : stableTitlePattern
  const versionMatch = title.match(titlePattern)
  if (!versionMatch) {
    issues.push(`Release PR title "${title}" does not match the expected ${baseBranch} release pattern.`)
  }

  if (!body.includes(generatedMarker)) {
    issues.push('Release PR body does not include the release-please generated marker.')
  }

  const unexpectedFiles = changedFiles.filter(fileName => !allowedFiles.has(fileName))
  if (unexpectedFiles.length > 0) {
    issues.push(`Release PR changes unexpected files: ${unexpectedFiles.join(', ')}`)
  }

  const missingFiles = [...requiredFiles].filter(fileName => !changedFiles.includes(fileName))
  if (missingFiles.length > 0) {
    issues.push(`Release PR is missing required version files: ${missingFiles.join(', ')}`)
  }

  if (versionMatch && baseVersion) {
    const proposedVersion = versionMatch[1]
    if (compareReleaseVersions(proposedVersion, baseVersion) <= 0) {
      issues.push(
        `Release PR version "${proposedVersion}" must be greater than the current ${baseBranch} version "${baseVersion}".`,
      )
    }
  }

  return issues
}

export function compareReleaseVersions(leftRaw, rightRaw) {
  const left = parseReleaseVersion(leftRaw)
  const right = parseReleaseVersion(rightRaw)

  if (left.major !== right.major) return left.major - right.major
  if (left.minor !== right.minor) return left.minor - right.minor
  if (left.patch !== right.patch) return left.patch - right.patch

  if (left.prerelease === null && right.prerelease === null) return 0
  if (left.prerelease === null) return 1
  if (right.prerelease === null) return -1

  if (left.prerelease.tag !== right.prerelease.tag) {
    return left.prerelease.tag.localeCompare(right.prerelease.tag)
  }

  return left.prerelease.number - right.prerelease.number
}

export function parseReleaseVersion(rawValue) {
  const match = rawValue.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+)(?:\.(\d+))?)?$/)
  if (!match) {
    throw new Error(`Invalid release version: ${rawValue}`)
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]
      ? {
          tag: match[4],
          number: Number(match[5] ?? '0'),
        }
      : null,
  }
}

if (import.meta.main) {
  const options = parseArgs(process.argv.slice(2))
  const body = options.bodyFile ? readFileSync(options.bodyFile, 'utf8') : process.env.PR_BODY || ''
  const changedFiles = options.changedFilesJson
    ? parseChangedFiles(options.changedFilesJson)
    : process.env.CHANGED_FILES_JSON
      ? parseChangedFiles(process.env.CHANGED_FILES_JSON)
      : []

  const issues = validateReleasePrPolicy({
    baseBranch: options.baseBranch ?? process.env.PR_BASE_BRANCH ?? '',
    baseVersion: options.baseVersion ?? process.env.PR_BASE_VERSION ?? '',
    body,
    changedFiles,
    headBranch: options.headBranch ?? process.env.PR_HEAD_BRANCH ?? '',
    title: options.title ?? process.env.PR_TITLE ?? '',
  })

  if (issues.length > 0) {
    console.error('Release PR policy check failed:\n')
    for (const issue of issues) console.error(`- ${issue}`)
    process.exit(1)
  }

  console.log('Release PR policy check passed.')
}

function parseArgs(args) {
  const options = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const nextValue = args[index + 1]

    if (arg === '--base-branch' && nextValue) {
      options.baseBranch = nextValue
      index += 1
    } else if (arg === '--base-version' && nextValue) {
      options.baseVersion = nextValue
      index += 1
    } else if (arg === '--body-file' && nextValue) {
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

function parseChangedFiles(rawValue) {
  const parsedValue = JSON.parse(rawValue)
  if (!Array.isArray(parsedValue) || parsedValue.some(value => typeof value !== 'string')) {
    throw new Error('Changed files must be a JSON array of file paths.')
  }

  return parsedValue
}
