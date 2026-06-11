import { execFile } from 'node:child_process'
import { appendFile } from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type ReleaseMode = 'publish' | 'pr' | 'skip'

export interface SuccessfulCiRun {
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
  mode: ReleaseMode
  npmTag: string
  reason: string
  sourceCiRunId: number | null
  targetBranch: string
  targetTag: string | null
  targetSha: string | null
}

export interface SelectReleaseCandidateOptions {
  commitsBySha: Record<string, CommitReleaseIntent>
  publishedNpmVersions?: Set<string>
  publishedReleaseShas: Set<string>
  publishedTags: Set<string>
  runs: SuccessfulCiRun[]
}

const releaseTagPattern = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const releaseCommitPattern = /^chore: release (?<version>\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/
const releaseWorthyPattern = /^(feat|fix|perf)(\(.+\))?!?:/

export function classifyCommitReleaseIntent(message: string): CommitReleaseIntent {
  const firstLine = message.split('\n')[0] ?? ''
  const releaseMatch = firstLine.match(releaseCommitPattern)

  return {
    firstLine,
    isReleaseCommit: Boolean(releaseMatch),
    isReleaseWorthy: releaseWorthyPattern.test(firstLine) || message.includes('\nBREAKING CHANGE:'),
    releaseVersion: releaseMatch?.groups?.version ?? null,
  }
}

export function selectReleaseCandidate({
  commitsBySha,
  publishedNpmVersions,
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

    return {
      configFile: '',
      mode: 'publish',
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
  if (
    latestReleaseRun &&
    latestReleaseVersion &&
    publishedNpmVersions &&
    !publishedNpmVersions.has(latestReleaseVersion)
  ) {
    return {
      configFile: '',
      mode: 'publish',
      npmTag: '',
      reason: `publish release commit ${latestReleaseVersion} because npm package is missing`,
      sourceCiRunId: latestReleaseRun.databaseId,
      targetBranch: '',
      targetTag: `v${latestReleaseVersion}`,
      targetSha: latestReleaseRun.headSha,
    }
  }

  const releasePrRun = newestRuns.find(run => commitsBySha[run.headSha]?.isReleaseWorthy)
  if (releasePrRun) {
    return {
      configFile: '',
      mode: 'pr',
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
    mode: 'skip',
    npmTag: '',
    reason: 'no successful release-worthy or pending release commit found on target branch',
    sourceCiRunId: null,
    targetBranch: '',
    targetTag: null,
    targetSha: null,
  }
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
  const reachableRuns = await filterRunsReachableFromHead(successfulRuns)
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
  const releaseVersions = reachableRuns
    .map(run => commitsBySha[run.headSha]?.releaseVersion)
    .filter((version): version is string => Boolean(version))
  const publishedNpmVersions = await listPublishedNpmVersions(releaseVersions)

  const resolution = selectReleaseCandidate({
    commitsBySha,
    publishedNpmVersions,
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

async function listPublishedNpmVersions(versions: string[]): Promise<Set<string>> {
  const publishedVersions = new Set<string>()
  const registryUrl = (process.env.NPM_CONFIG_REGISTRY ?? 'https://registry.npmjs.org').replace(/\/$/, '')

  await Promise.all(
    [...new Set(versions)].map(async version => {
      const response = await fetch(`${registryUrl}/quantex-cli/${encodeURIComponent(version)}`, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (response.status === 404) return
      if (!response.ok) {
        throw new Error(
          `Unable to inspect npm package quantex-cli@${version}: ${response.status} ${response.statusText}`,
        )
      }

      publishedVersions.add(version)
    }),
  )

  return publishedVersions
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
    `mode=${resolution.mode}`,
    `npm_tag=${resolution.npmTag}`,
    `reason=${resolution.reason}`,
    `source_ci_run_id=${resolution.sourceCiRunId ?? ''}`,
    `target_branch=${resolution.targetBranch}`,
    `target_tag=${resolution.targetTag ?? ''}`,
    `target_sha=${resolution.targetSha ?? ''}`,
  ]

  await appendFile(outputPath, `${lines.join('\n')}\n`)
}
