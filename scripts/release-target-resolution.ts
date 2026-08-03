import { execFile } from 'node:child_process'
import { appendFile } from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type ReleasePreparationMode = 'pr' | 'skip'

export interface SuccessfulCiRun {
  databaseId: number
  headBranch?: string
  headSha: string
  updatedAt?: string
}

export interface CommitReleaseIntent {
  firstLine: string
  isReleaseWorthy: boolean
}

export interface ReleasePreparationResolution {
  configFile: string
  mode: ReleasePreparationMode
  reason: string
  sourceCiRunId: number | null
  targetBranch: 'beta' | 'main'
  targetSha: string | null
}

const releaseWorthyPattern = /^(feat|fix|perf)(\(.+\))?!?:/
const releaseAsPattern = /^release-as:\s*\S+\s*$/im

export function classifyCommitReleaseIntent(message: string): CommitReleaseIntent {
  const firstLine = message.split('\n')[0] ?? ''

  return {
    firstLine,
    isReleaseWorthy:
      releaseWorthyPattern.test(firstLine) || message.includes('\nBREAKING CHANGE:') || releaseAsPattern.test(message),
  }
}

export function selectReleasePreparation(input: {
  commitsBySha: Record<string, CommitReleaseIntent>
  runs: SuccessfulCiRun[]
}): Pick<ReleasePreparationResolution, 'mode' | 'reason' | 'sourceCiRunId' | 'targetSha'> {
  const releaseWorthyRun = dedupeRunsByHeadSha(input.runs).find(run => input.commitsBySha[run.headSha]?.isReleaseWorthy)

  if (releaseWorthyRun) {
    return {
      mode: 'pr',
      reason: 'prepare or refresh release PR from latest successful release-worthy CI run',
      sourceCiRunId: releaseWorthyRun.databaseId,
      targetSha: releaseWorthyRun.headSha,
    }
  }

  return {
    mode: 'skip',
    reason: 'no successful release-worthy commit found on target branch',
    sourceCiRunId: null,
    targetSha: null,
  }
}

export function resolveReleaseBranch(input: string): {
  configFile: string
  targetBranch: 'beta' | 'main'
} {
  if (input === 'main') return { configFile: 'release-please-config.json', targetBranch: input }
  if (input === 'beta') return { configFile: 'release-please-config.beta.json', targetBranch: input }
  throw new Error(`Unsupported release target branch: ${input}. Expected main or beta.`)
}

if (import.meta.main) {
  const resolution = await resolveReleasePreparationFromEnvironment()
  await writeGithubOutputs(resolution)
  console.log(JSON.stringify(resolution))
}

async function resolveReleasePreparationFromEnvironment(): Promise<ReleasePreparationResolution> {
  const { configFile, targetBranch } = resolveReleaseBranch(
    process.env.RELEASE_TARGET_BRANCH || process.env.INPUT_TARGET_BRANCH || '',
  )
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN

  if (!repository) throw new Error('GITHUB_REPOSITORY is required.')
  if (!token) throw new Error('GITHUB_TOKEN or GH_TOKEN is required.')

  const successfulRuns = await listSuccessfulCiRuns({ repository, targetBranch, token })
  const reachableRuns = await filterRunsReachableFromHead(successfulRuns, targetBranch)
  const commitsBySha = Object.fromEntries(
    await Promise.all(
      reachableRuns.map(
        async run => [run.headSha, classifyCommitReleaseIntent(await readCommitMessage(run.headSha))] as const,
      ),
    ),
  )

  return {
    ...selectReleasePreparation({ commitsBySha, runs: reachableRuns }),
    configFile,
    targetBranch,
  }
}

function dedupeRunsByHeadSha(runs: SuccessfulCiRun[]): SuccessfulCiRun[] {
  const sortedRuns = [...runs].sort((left, right) => {
    const leftTimestamp = Date.parse(left.updatedAt ?? '')
    const rightTimestamp = Date.parse(right.updatedAt ?? '')
    if (!Number.isNaN(leftTimestamp) && !Number.isNaN(rightTimestamp) && leftTimestamp !== rightTimestamp)
      return rightTimestamp - leftTimestamp
    return right.databaseId - left.databaseId
  })
  const seen = new Set<string>()
  return sortedRuns.filter(run => {
    if (seen.has(run.headSha)) return false
    seen.add(run.headSha)
    return true
  })
}

async function listSuccessfulCiRuns(input: {
  repository: string
  targetBranch: string
  token: string
}): Promise<SuccessfulCiRun[]> {
  const apiBaseUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const url = new URL(`${apiBaseUrl}/repos/${input.repository}/actions/workflows/ci.yml/runs`)
  url.searchParams.set('branch', input.targetBranch)
  url.searchParams.set('event', 'push')
  url.searchParams.set('status', 'completed')
  url.searchParams.set('per_page', '100')

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${input.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!response.ok)
    throw new Error(
      `Unable to list successful CI runs for ${input.targetBranch}: ${response.status} ${response.statusText}`,
    )

  const payload = (await response.json()) as {
    workflow_runs?: Array<{
      conclusion?: string
      head_branch?: string
      head_sha?: string
      id?: number
      updated_at?: string
    }>
  }
  return (payload.workflow_runs ?? [])
    .filter(
      run =>
        run.conclusion === 'success' &&
        run.head_branch === input.targetBranch &&
        typeof run.head_sha === 'string' &&
        typeof run.id === 'number',
    )
    .map(run => ({
      databaseId: run.id as number,
      headBranch: run.head_branch,
      headSha: run.head_sha as string,
      updatedAt: run.updated_at,
    }))
}

async function filterRunsReachableFromHead(runs: SuccessfulCiRun[], targetBranch: string): Promise<SuccessfulCiRun[]> {
  const branchTipSha = (await execFileAsync('git', ['rev-parse', `origin/${targetBranch}`])).stdout.trim()
  const reachableRuns: SuccessfulCiRun[] = []
  for (const run of runs) {
    try {
      await execFileAsync('git', ['merge-base', '--is-ancestor', run.headSha, branchTipSha])
      reachableRuns.push(run)
    } catch {
      // Ignore successful runs that are no longer reachable from the protected branch.
    }
  }
  return reachableRuns
}

async function readCommitMessage(sha: string): Promise<string> {
  return (await execFileAsync('git', ['log', '-1', '--pretty=%B', sha])).stdout.trimEnd()
}

async function writeGithubOutputs(resolution: ReleasePreparationResolution): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) return
  await appendFile(
    outputPath,
    [
      `config_file=${resolution.configFile}`,
      `mode=${resolution.mode}`,
      `reason=${resolution.reason}`,
      `source_ci_run_id=${resolution.sourceCiRunId ?? ''}`,
      `target_branch=${resolution.targetBranch}`,
      `target_sha=${resolution.targetSha ?? ''}`,
      '',
    ].join('\n'),
  )
}
