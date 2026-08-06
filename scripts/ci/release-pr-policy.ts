import { readFileSync } from 'node:fs'
import process from 'node:process'

export interface ReleasePrManifest {
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export interface ReleasePrPolicyInput {
  baseBranch: string
  baseVersion: string
  body: string
  changedFiles: string[]
  headBranch: string
  rootManifest: ReleasePrManifest
  title: string
}

interface ReleaseVersion {
  major: number
  minor: number
  patch: number
  prerelease: { tag: string; number: number } | null
}

// main is the only release channel, so one pattern covers both shapes: a
// stable version, or a prerelease previewing the next unreleased version.
const releaseTitlePattern = /^chore: release (\d+\.\d+\.\d+(?:-beta(?:\.\d+)?)?)$/
const generatedMarker = 'This PR was generated with [Release Please]'
const finalZeroMajorVersion = '0.29.1'
const firstPostRedesignVersion = '1.1.0'
const burnedStableReleaseVersions = new Set(['1.0.0'])
const releaseBranches = new Set(['main'])

const allowedFiles = new Set([
  '.release-please-manifest.json',
  'CHANGELOG.md',
  'package.json',
  'src/generated/build-meta.ts',
])

const requiredFiles = new Set(['.release-please-manifest.json', 'package.json', 'src/generated/build-meta.ts'])

const dependencySections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const

export function validateReleasePrPolicy(input: ReleasePrPolicyInput): string[] {
  const issues: string[] = []
  const baseBranch = input.baseBranch || ''
  const headBranch = input.headBranch || ''
  const title = input.title || ''
  const body = input.body || ''
  const changedFiles = [...(input.changedFiles || [])].sort()
  const baseVersion = input.baseVersion || ''
  const rootManifest = isRecord(input.rootManifest) ? input.rootManifest : null
  const rootVersion = readString(rootManifest?.version)

  if (!releaseBranches.has(baseBranch)) {
    issues.push(`Release PR base branch "${baseBranch}" is not allowed; expected main.`)
  }

  if (!baseVersion) {
    issues.push('Release PR policy requires the current base package version.')
  }

  const expectedHeadBranch = `release-please--branches--${baseBranch}--components--quantex-cli`
  if (headBranch !== expectedHeadBranch) {
    issues.push(`Unexpected release-please branch "${headBranch}". Expected "${expectedHeadBranch}".`)
  }

  const versionMatch = title.match(releaseTitlePattern)
  if (!versionMatch) {
    issues.push(`Release PR title "${title}" does not match the expected release pattern.`)
  }

  if (!body.includes(generatedMarker)) {
    issues.push('Release PR body does not include the release-please generated marker.')
  }

  if (!rootManifest) {
    issues.push('Release PR policy requires the root package.json manifest from the PR head.')
  }

  if (versionMatch) {
    const proposedVersion = versionMatch[1]!

    validateManifestVersion(issues, 'Root package.json', rootVersion, proposedVersion)
  }

  for (const issue of findWorkspaceProtocolIssues('package.json', rootManifest)) issues.push(issue)

  const unexpectedFiles = changedFiles.filter(fileName => !allowedFiles.has(fileName))
  if (unexpectedFiles.length > 0) {
    issues.push(`Release PR changes unexpected files: ${unexpectedFiles.join(', ')}`)
  }

  const missingFiles = [...requiredFiles].filter(fileName => !changedFiles.includes(fileName))
  if (missingFiles.length > 0) {
    issues.push(`Release PR is missing required version files: ${missingFiles.join(', ')}`)
  }

  if (versionMatch && baseVersion) {
    const proposedVersion = versionMatch[1]!
    if (compareReleaseVersions(proposedVersion, baseVersion) <= 0) {
      issues.push(
        `Release PR version "${proposedVersion}" must be greater than the current ${baseBranch} version "${baseVersion}".`,
      )
    }

    if (baseBranch === 'main' && isAccidentalPreMajorGraduation(proposedVersion, baseVersion)) {
      issues.push(
        [
          `Release PR version "${proposedVersion}" would promote the ${baseBranch} release line from "${baseVersion}" to 1.0.0.`,
          'Pre-1.0 breaking changes must stay on the zero-major minor line unless a dedicated 1.0 graduation contract allows it.',
        ].join(' '),
      )
    }

    if (baseBranch === 'main' && isLaterZeroMajorRelease(proposedVersion, baseVersion)) {
      issues.push(
        `Release PR version "${proposedVersion}" is not allowed because ${finalZeroMajorVersion} is the final stable 0.x release.`,
      )
    }

    if (baseBranch === 'main' && isUnapprovedStableGraduation(proposedVersion, baseVersion)) {
      issues.push(
        `Release PR version "${proposedVersion}" is not allowed from "${baseVersion}"; the only allowed stable graduation is "${finalZeroMajorVersion}" to "${firstPostRedesignVersion}".`,
      )
    }

    if (baseBranch === 'main' && isUndeclaredMajorBump(proposedVersion, baseVersion, body)) {
      issues.push(
        [
          `Release PR version "${proposedVersion}" is a major bump from "${baseVersion}".`,
          `A maintainer must explicitly approve the new major by adding a "Release-As: ${proposedVersion}" line to the Release PR body before merge.`,
        ].join(' '),
      )
    }
  }

  if (versionMatch && baseBranch === 'main') {
    const proposedVersion = versionMatch[1]!
    if (burnedStableReleaseVersions.has(proposedVersion)) {
      issues.push(
        `Release PR version "${proposedVersion}" is a burned stable release version and must not be published again.`,
      )
    }
  }

  return issues
}

function validateManifestVersion(
  issues: string[],
  label: string,
  actualVersion: string,
  proposedVersion: string,
): void {
  if (!actualVersion) {
    issues.push(`${label} must contain an exact release version.`)
    return
  }

  if (actualVersion !== proposedVersion) {
    issues.push(`${label} version "${actualVersion}" must equal Release PR title version "${proposedVersion}".`)
  }
}

function findWorkspaceProtocolIssues(manifestPath: string, manifest: ReleasePrManifest | null): string[] {
  if (!manifest) return []

  const issues: string[] = []

  for (const sectionName of dependencySections) {
    const section = isRecord(manifest[sectionName]) ? manifest[sectionName] : null
    if (!section) continue

    for (const [dependencyName, dependencyVersion] of Object.entries(section)) {
      if (typeof dependencyVersion !== 'string' || !dependencyVersion.trim().startsWith('workspace:')) continue

      issues.push(
        `${manifestPath} ${sectionName}["${dependencyName}"] uses forbidden workspace protocol "${dependencyVersion}".`,
      )
    }
  }

  return issues
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isLaterZeroMajorRelease(proposedRaw: string, baseRaw: string): boolean {
  const proposed = parseReleaseVersion(proposedRaw)
  const base = parseReleaseVersion(baseRaw)

  return (
    baseRaw === finalZeroMajorVersion &&
    base.prerelease === null &&
    proposed.prerelease === null &&
    proposed.major === 0 &&
    compareReleaseVersions(proposedRaw, baseRaw) > 0
  )
}

export function isUnapprovedStableGraduation(proposedRaw: string, baseRaw: string): boolean {
  const proposed = parseReleaseVersion(proposedRaw)
  const base = parseReleaseVersion(baseRaw)

  if (base.prerelease !== null || proposed.prerelease !== null || base.major !== 0 || proposed.major < 1) {
    return false
  }

  return !(baseRaw === finalZeroMajorVersion && proposedRaw === firstPostRedesignVersion)
}

export function isAccidentalPreMajorGraduation(proposedRaw: string, baseRaw: string): boolean {
  const proposed = parseReleaseVersion(proposedRaw)
  const base = parseReleaseVersion(baseRaw)

  return (
    base.prerelease === null &&
    proposed.prerelease === null &&
    base.major === 0 &&
    proposed.major === 1 &&
    proposed.minor === 0 &&
    proposed.patch === 0
  )
}

function isUndeclaredMajorBump(proposedRaw: string, baseRaw: string, body: string): boolean {
  const proposed = parseReleaseVersion(proposedRaw)
  const base = parseReleaseVersion(baseRaw)

  if (base.prerelease !== null || proposed.prerelease !== null || base.major === 0 || proposed.major <= base.major) {
    return false
  }

  return !new RegExp(`^release-as:\\s*${escapeRegExp(proposedRaw)}\\s*$`, 'im').test(body)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function compareReleaseVersions(leftRaw: string, rightRaw: string): number {
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

export function parseReleaseVersion(rawValue: string): ReleaseVersion {
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

interface ReleasePrCliOptions {
  baseBranch?: string
  baseVersion?: string
  bodyFile?: string
  changedFilesJson?: string
  headBranch?: string
  title?: string
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
    rootManifest: readManifestFile('package.json'),
    title: options.title ?? process.env.PR_TITLE ?? '',
  })

  if (issues.length > 0) {
    console.error('Release PR policy check failed:\n')
    for (const issue of issues) console.error(`- ${issue}`)
    process.exit(1)
  }

  console.log('Release PR policy check passed.')
}

function parseArgs(args: string[]): ReleasePrCliOptions {
  const options: ReleasePrCliOptions = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!
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

function parseChangedFiles(rawValue: string): string[] {
  const parsedValue = JSON.parse(rawValue)
  if (!Array.isArray(parsedValue) || parsedValue.some(value => typeof value !== 'string')) {
    throw new Error('Changed files must be a JSON array of file paths.')
  }

  return parsedValue as string[]
}

function readManifestFile(filePath: string): ReleasePrManifest {
  const parsedValue = JSON.parse(readFileSync(filePath, 'utf8'))
  if (!isRecord(parsedValue)) throw new Error(`${filePath} must contain a JSON object.`)
  return parsedValue as ReleasePrManifest
}
