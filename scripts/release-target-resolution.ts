import { execFile } from 'node:child_process'
import { appendFile } from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type ReleaseMode = 'publish' | 'pr' | 'skip'

export const repositoryNpmPackageNames = ['@quantex/core', 'quantex-cli'] as const

export type RepositoryNpmPackageName = (typeof repositoryNpmPackageNames)[number]
export type NpmPackagePublicationStatus = 'indeterminate' | 'missing' | 'published'
export type NpmReleaseIntegrity =
  | 'both-missing'
  | 'both-published'
  | 'cli-missing'
  | 'core-missing'
  | 'legacy-cli-missing'
  | 'legacy-cli-published'
  | 'registry-indeterminate'

export interface NpmPackagePublicationState {
  detail?: string
  status: NpmPackagePublicationStatus
}

export interface NpmReleasePublicationState {
  '@quantex/core'?: NpmPackagePublicationState
  'quantex-cli': NpmPackagePublicationState
}

export interface SuccessfulCiRun {
  corePackagePresent?: boolean
  databaseId: number
  displayTitle?: string
  headBranch?: string
  headSha: string
  updatedAt?: string
}

export interface CommitReleaseIntent {
  firstLine: string
  isReleaseCommit: boolean
  isReleaseWorthy: boolean
  releaseVersion: string | null
}

export interface ReleaseTargetResolution {
  configFile: string
  coreRequired: boolean
  mode: ReleaseMode
  npmIntegrity: NpmReleaseIntegrity | 'not-applicable'
  npmTag: string
  reason: string
  sourceCiRunId: number | null
  targetBranch: string
  targetTag: string | null
  targetSha: string | null
}

export interface SelectReleaseCandidateOptions {
  commitsBySha: Record<string, CommitReleaseIntent>
  npmPublicationsByVersion: Record<string, NpmReleasePublicationState>
  publishedReleaseShas: Set<string>
  publishedTags: Set<string>
  runs: SuccessfulCiRun[]
}

const releaseTagPattern = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const releaseCommitPattern = /^chore: release (?<version>\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/
const releaseWorthyPattern = /^(feat|fix|perf)(\(.+\))?!?:/
const releaseAsPattern = /^release-as:\s*\S+\s*$/im

export function classifyCommitReleaseIntent(message: string): CommitReleaseIntent {
  const firstLine = message.split('\n')[0] ?? ''
  const releaseMatch = firstLine.match(releaseCommitPattern)

  return {
    firstLine,
    isReleaseCommit: Boolean(releaseMatch),
    isReleaseWorthy:
      releaseWorthyPattern.test(firstLine) || message.includes('\nBREAKING CHANGE:') || releaseAsPattern.test(message),
    releaseVersion: releaseMatch?.groups?.version ?? null,
  }
}

export function classifyNpmReleaseIntegrity(
  publication: NpmReleasePublicationState,
  coreRequired = true,
): NpmReleaseIntegrity {
  const cliStatus = publication['quantex-cli'].status

  if (!coreRequired) {
    if (cliStatus === 'indeterminate') return 'registry-indeterminate'
    return cliStatus === 'published' ? 'legacy-cli-published' : 'legacy-cli-missing'
  }

  const coreStatus = publication['@quantex/core']?.status ?? 'indeterminate'

  if (coreStatus === 'indeterminate' || cliStatus === 'indeterminate') return 'registry-indeterminate'
  if (coreStatus === 'published' && cliStatus === 'published') return 'both-published'
  if (coreStatus === 'missing' && cliStatus === 'missing') return 'both-missing'
  if (coreStatus === 'missing') return 'core-missing'
  return 'cli-missing'
}

export function selectReleaseCandidate({
  commitsBySha,
  npmPublicationsByVersion,
  publishedReleaseShas,
  publishedTags,
  runs,
}: SelectReleaseCandidateOptions): ReleaseTargetResolution {
  const newestRuns = dedupeRunsByHeadSha(runs)

  const untaggedReleaseRuns = newestRuns.filter(run => {
    const commit = commitsBySha[run.headSha]
    const releaseVersion = commit?.releaseVersion
    if (!commit?.isReleaseCommit || !releaseVersion) return false

    return !publishedTags.has(`v${releaseVersion}`) && !publishedReleaseShas.has(run.headSha)
  })

  if (untaggedReleaseRuns.length > 1) {
    const versions = untaggedReleaseRuns
      .map(run => commitsBySha[run.headSha]?.releaseVersion)
      .filter((version): version is string => Boolean(version))
      .join(', ')

    throw new Error(
      `Multiple successful untagged release commits are pending publication (${versions}). Manual recovery is required before automation can continue.`,
    )
  }

  const untaggedReleaseRun = untaggedReleaseRuns[0]
  if (untaggedReleaseRun) {
    const commit = commitsBySha[untaggedReleaseRun.headSha]
    const releaseVersion = commit.releaseVersion as string
    const tagName = `v${releaseVersion}`
    const coreRequired = untaggedReleaseRun.corePackagePresent !== false
    const npmIntegrity = resolveNpmReleaseIntegrity(releaseVersion, npmPublicationsByVersion, coreRequired)

    return {
      configFile: '',
      coreRequired,
      mode: 'publish',
      npmIntegrity,
      npmTag: '',
      reason: `publish pending untagged release commit ${releaseVersion}`,
      sourceCiRunId: untaggedReleaseRun.databaseId,
      targetBranch: '',
      targetTag: tagName,
      targetSha: untaggedReleaseRun.headSha,
    }
  }

  const latestReleaseRun = newestRuns.find(run => commitsBySha[run.headSha]?.isReleaseCommit)
  const latestReleaseCommit = latestReleaseRun ? commitsBySha[latestReleaseRun.headSha] : undefined
  const latestReleaseVersion = latestReleaseCommit?.releaseVersion
  let latestNpmIntegrity: NpmReleaseIntegrity | 'not-applicable' = 'not-applicable'
  let latestCoreRequired = false

  if (latestReleaseRun && latestReleaseVersion) {
    latestCoreRequired = latestReleaseRun.corePackagePresent !== false
    const resolvedNpmIntegrity = resolveNpmReleaseIntegrity(
      latestReleaseVersion,
      npmPublicationsByVersion,
      latestCoreRequired,
    )
    latestNpmIntegrity = resolvedNpmIntegrity

    if (resolvedNpmIntegrity !== 'both-published' && resolvedNpmIntegrity !== 'legacy-cli-published') {
      return {
        configFile: '',
        coreRequired: latestCoreRequired,
        mode: 'publish',
        npmIntegrity: resolvedNpmIntegrity,
        npmTag: '',
        reason: `publish release commit ${latestReleaseVersion} because ${describeMissingPackages(resolvedNpmIntegrity)}`,
        sourceCiRunId: latestReleaseRun.databaseId,
        targetBranch: '',
        targetTag: `v${latestReleaseVersion}`,
        targetSha: latestReleaseRun.headSha,
      }
    }
  }

  const releasePrRun = newestRuns.find(run => commitsBySha[run.headSha]?.isReleaseWorthy)
  if (releasePrRun) {
    return {
      configFile: '',
      coreRequired: latestCoreRequired,
      mode: 'pr',
      npmIntegrity: latestNpmIntegrity,
      npmTag: '',
      reason: 'prepare or refresh release PR from latest successful release-worthy CI run',
      sourceCiRunId: releasePrRun.databaseId,
      targetBranch: '',
      targetTag: null,
      targetSha: releasePrRun.headSha,
    }
  }

  return {
    configFile: '',
    coreRequired: latestCoreRequired,
    mode: 'skip',
    npmIntegrity: latestNpmIntegrity,
    npmTag: '',
    reason: 'no successful release-worthy or pending release commit found on target branch',
    sourceCiRunId: null,
    targetBranch: '',
    targetTag: null,
    targetSha: null,
  }
}

function resolveNpmReleaseIntegrity(
  version: string,
  publicationsByVersion: Record<string, NpmReleasePublicationState>,
  coreRequired: boolean,
): Exclude<NpmReleaseIntegrity, 'registry-indeterminate'> {
  const publication = publicationsByVersion[version]
  if (!publication) {
    throw new Error(
      `Cannot determine npm publication integrity for release ${version}: no registry inspection result is available. Release automation fails closed.`,
    )
  }

  const integrity = classifyNpmReleaseIntegrity(publication, coreRequired)
  if (integrity !== 'registry-indeterminate') return integrity

  const diagnostics = repositoryNpmPackageNames
    .filter(
      packageName =>
        (coreRequired || packageName === 'quantex-cli') && publication[packageName]?.status !== 'published',
    )
    .map(
      packageName =>
        `${packageName}: ${publication[packageName]?.detail ?? (publication[packageName] ? 'registry inspection failed' : 'inspection result missing')}`,
    )
    .join('; ')

  throw new Error(
    `Cannot determine npm publication integrity for release ${version}: ${diagnostics}. Release automation fails closed without publishing either repository-owned package.`,
  )
}

function describeMissingPackages(
  integrity: Exclude<NpmReleaseIntegrity, 'both-published' | 'legacy-cli-published' | 'registry-indeterminate'>,
): string {
  if (integrity === 'core-missing') return '@quantex/core is missing from npm'
  if (integrity === 'cli-missing') return 'quantex-cli is missing from npm'
  if (integrity === 'legacy-cli-missing') return 'legacy quantex-cli is missing from npm'
  return '@quantex/core and quantex-cli are missing from npm'
}

function dedupeRunsByHeadSha(runs: SuccessfulCiRun[]): SuccessfulCiRun[] {
  const sortedRuns = [...runs].sort((left, right) => {
    const leftTimestamp = Date.parse(left.updatedAt ?? '')
    const rightTimestamp = Date.parse(right.updatedAt ?? '')

    if (!Number.isNaN(leftTimestamp) && !Number.isNaN(rightTimestamp) && leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp
    }

    return right.databaseId - left.databaseId
  })

  const seen = new Set<string>()
  const dedupedRuns: SuccessfulCiRun[] = []

  for (const run of sortedRuns) {
    if (seen.has(run.headSha)) continue
    seen.add(run.headSha)
    dedupedRuns.push(run)
  }

  return dedupedRuns
}

if (import.meta.main) {
  const resolution = await resolveReleaseTargetFromEnvironment()
  await writeGithubOutputs(resolution)
  console.log(JSON.stringify(resolution))
}

async function resolveReleaseTargetFromEnvironment(): Promise<ReleaseTargetResolution> {
  const targetBranch = readTargetBranchFromEnv()
  const { configFile, npmTag } = getReleaseChannelConfig(targetBranch)
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN

  if (!repository) throw new Error('GITHUB_REPOSITORY is required.')
  if (!token) throw new Error('GITHUB_TOKEN or GH_TOKEN is required.')

  const successfulRuns = await listSuccessfulCiRuns({ repository, targetBranch, token })
  const reachableRuns = await Promise.all(
    (await filterRunsReachableFromHead(successfulRuns)).map(async run => ({
      ...run,
      corePackagePresent: await fileExistsAtCommit(run.headSha, 'packages/core/package.json'),
    })),
  )
  const commitsBySha = Object.fromEntries(
    await Promise.all(
      reachableRuns.map(
        async run => [run.headSha, classifyCommitReleaseIntent(await readCommitMessage(run.headSha))] as const,
      ),
    ),
  )
  const publishedTags = new Set(
    reachableRuns
      .map(run => commitsBySha[run.headSha]?.releaseVersion)
      .filter((version): version is string => Boolean(version))
      .filter(version => tagExists(`v${version}`)),
  )
  const publishedReleaseShas = new Set(
    reachableRuns.filter(run => releaseTagPointsAtCommit(run.headSha)).map(run => run.headSha),
  )
  const releases = reachableRuns.flatMap(run => {
    const version = commitsBySha[run.headSha]?.releaseVersion
    return version ? [{ coreRequired: run.corePackagePresent !== false, version }] : []
  })
  const npmPublicationsByVersion = await inspectNpmReleasePublications(releases)

  const resolution = selectReleaseCandidate({
    commitsBySha,
    npmPublicationsByVersion,
    publishedReleaseShas,
    publishedTags: new Set([...publishedTags].map(version => `v${version}`)),
    runs: reachableRuns,
  })

  return {
    ...resolution,
    configFile,
    npmTag,
    targetBranch,
  }
}

async function inspectNpmReleasePublications(
  releases: Array<{ coreRequired: boolean; version: string }>,
): Promise<Record<string, NpmReleasePublicationState>> {
  const registryUrl = (process.env.NPM_CONFIG_REGISTRY ?? 'https://registry.npmjs.org').replace(/\/$/, '')
  const publicationsByVersion: Record<string, NpmReleasePublicationState> = {}
  const requirementsByVersion = new Map<string, boolean>()

  for (const release of releases) {
    requirementsByVersion.set(
      release.version,
      (requirementsByVersion.get(release.version) ?? false) || release.coreRequired,
    )
  }

  await Promise.all(
    [...requirementsByVersion].map(async ([version, coreRequired]) => {
      const packageNames: readonly RepositoryNpmPackageName[] = coreRequired
        ? repositoryNpmPackageNames
        : ['quantex-cli']
      const entries = await Promise.all(
        packageNames.map(async packageName => {
          const publication = await inspectNpmPackageVersion({ packageName, registryUrl, version })
          return [packageName, publication] as const
        }),
      )

      publicationsByVersion[version] = Object.fromEntries(entries) as unknown as NpmReleasePublicationState
    }),
  )

  return publicationsByVersion
}

async function inspectNpmPackageVersion({
  packageName,
  registryUrl,
  version,
}: {
  packageName: RepositoryNpmPackageName
  registryUrl: string
  version: string
}): Promise<NpmPackagePublicationState> {
  const registryPackageName = encodeURIComponent(packageName).replace(/^%40/, '@')

  try {
    const response = await fetch(`${registryUrl}/${registryPackageName}/${encodeURIComponent(version)}`, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (response.status === 404) return { status: 'missing' }
    if (!response.ok) {
      return {
        detail: `HTTP ${response.status} ${response.statusText}`,
        status: 'indeterminate',
      }
    }

    const payload = (await response.json()) as { version?: unknown }
    if (payload.version !== version) {
      return {
        detail: `registry returned version ${String(payload.version)} for exact request ${version}`,
        status: 'indeterminate',
      }
    }

    return { status: 'published' }
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : String(error),
      status: 'indeterminate',
    }
  }
}

function readTargetBranchFromEnv(): string {
  return process.env.RELEASE_TARGET_BRANCH || process.env.INPUT_TARGET_BRANCH || process.env.GITHUB_REF_NAME || 'main'
}

function getReleaseChannelConfig(targetBranch: string): { configFile: string; npmTag: string } {
  if (targetBranch === 'beta') {
    return {
      configFile: 'release-please-config.beta.json',
      npmTag: 'beta',
    }
  }

  return {
    configFile: 'release-please-config.json',
    npmTag: 'latest',
  }
}

async function listSuccessfulCiRuns({
  repository,
  targetBranch,
  token,
}: {
  repository: string
  targetBranch: string
  token: string
}): Promise<SuccessfulCiRun[]> {
  const [owner, repo] = repository.split('/')
  const apiBaseUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const url = new URL(`${apiBaseUrl}/repos/${owner}/${repo}/actions/workflows/ci.yml/runs`)
  url.searchParams.set('branch', targetBranch)
  url.searchParams.set('event', 'push')
  url.searchParams.set('status', 'completed')
  url.searchParams.set('per_page', '100')

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    throw new Error(`Unable to list successful CI runs for ${targetBranch}: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as {
    workflow_runs?: Array<{
      conclusion?: string
      head_branch?: string
      head_sha?: string
      id?: number
      name?: string
      updated_at?: string
    }>
  }

  return (payload.workflow_runs ?? [])
    .filter(run => run.conclusion === 'success' && run.head_branch === targetBranch && run.head_sha && run.id)
    .map(run => ({
      databaseId: run.id as number,
      displayTitle: run.name,
      headBranch: run.head_branch,
      headSha: run.head_sha as string,
      updatedAt: run.updated_at,
    }))
}

async function filterRunsReachableFromHead(runs: SuccessfulCiRun[]): Promise<SuccessfulCiRun[]> {
  const branchTipSha = await getRemoteBranchTipSha()
  const reachableRuns: SuccessfulCiRun[] = []

  for (const run of runs) {
    if (await isAncestorOf(run.headSha, branchTipSha)) {
      reachableRuns.push(run)
    }
  }

  return reachableRuns
}

async function getRemoteBranchTipSha(): Promise<string> {
  const branch = readTargetBranchFromEnv()
  const remoteRef = `origin/${branch}`

  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', remoteRef])
    const sha = stdout.trim()
    if (sha) return sha
  } catch {
    // Missing remote ref (local runs without fetch); fall back to HEAD below.
  }

  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'])
  return stdout.trim()
}

async function isAncestorOf(sha: string, tipSha: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['merge-base', '--is-ancestor', sha, tipSha])
    return true
  } catch {
    return false
  }
}

async function fileExistsAtCommit(sha: string, fileName: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['cat-file', '-e', `${sha}:${fileName}`])
    return true
  } catch {
    return false
  }
}

async function readCommitMessage(sha: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['log', '-1', '--pretty=%B', sha])
  return stdout.trimEnd()
}

function tagExists(tagName: string): boolean {
  try {
    execFileSyncCompatible('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tagName}`])
    return true
  } catch {
    return false
  }
}

function releaseTagPointsAtCommit(sha: string): boolean {
  try {
    return execFileSyncCompatible('git', ['tag', '--points-at', sha, '--list', 'v*'])
      .split('\n')
      .some(tag => releaseTagPattern.test(tag.trim()))
  } catch {
    return false
  }
}

function execFileSyncCompatible(file: string, args: string[]): string {
  const bunSpawn = Bun.spawnSync([file, ...args], {
    stderr: 'pipe',
    stdout: 'pipe',
  })

  if (bunSpawn.exitCode !== 0) {
    throw new Error(Buffer.from(bunSpawn.stderr).toString('utf8'))
  }

  return Buffer.from(bunSpawn.stdout).toString('utf8')
}

async function writeGithubOutputs(resolution: ReleaseTargetResolution): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) return

  const lines = [
    `config_file=${resolution.configFile}`,
    `core_required=${String(resolution.coreRequired)}`,
    `mode=${resolution.mode}`,
    `npm_integrity=${resolution.npmIntegrity}`,
    `npm_tag=${resolution.npmTag}`,
    `reason=${resolution.reason}`,
    `source_ci_run_id=${resolution.sourceCiRunId ?? ''}`,
    `target_branch=${resolution.targetBranch}`,
    `target_tag=${resolution.targetTag ?? ''}`,
    `target_sha=${resolution.targetSha ?? ''}`,
  ]

  await appendFile(outputPath, `${lines.join('\n')}\n`)
}
