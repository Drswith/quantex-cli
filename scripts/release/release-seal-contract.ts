import { execFile } from 'node:child_process'
import { appendFile, readFile } from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'
import { assertStableReleaseReady } from './release-readiness'

const execFileAsync = promisify(execFile)
const releaseVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

export interface ReleaseIdentityInput {
  branchContainsSha: boolean
  branchHeadSha: string
  ciSha: string | null
  commitSha: string
  commitTitle: string
  packageVersion: string
  requestedBranch: string
  requestedTag: string
  tagSha: string | null
}

export interface ReleaseIdentity {
  channel: 'beta' | 'stable'
  commitSha: string
  npmTag: 'beta' | 'latest'
  prerelease: boolean
  tag: string
  targetBranch: 'main'
  version: string
}

export function validateReleaseIdentity(input: ReleaseIdentityInput): ReleaseIdentity {
  if (!releaseVersionPattern.test(input.packageVersion))
    throw new Error(`Invalid release package version: ${input.packageVersion}.`)

  assertStableReleaseReady(input.packageVersion)

  // Every release is cut from main. A prerelease suffix only changes the
  // defensive npm dist-tag mapping; the repository does not maintain a
  // preview channel or fork a second branch.
  const prerelease = input.packageVersion.includes('-')
  const targetBranch = 'main'
  const channel = prerelease ? 'beta' : 'stable'
  const npmTag = prerelease ? 'beta' : 'latest'
  const expectedTag = `v${input.packageVersion}`
  const expectedTitle = `chore: release ${input.packageVersion}`

  if (input.requestedBranch !== targetBranch)
    throw new Error(
      `Release ${input.packageVersion} must be published from ${targetBranch}, not ${input.requestedBranch}.`,
    )
  if (input.requestedTag !== expectedTag)
    throw new Error(`Release tag ${input.requestedTag} does not match package version ${input.packageVersion}.`)
  const normalizedCommitTitle = input.commitTitle.replace(/\s*\(#\d+\)\s*$/, '')
  if (normalizedCommitTitle !== expectedTitle)
    throw new Error(`Release commit title must be exactly "${expectedTitle}", found "${input.commitTitle}".`)
  if (!input.branchContainsSha)
    throw new Error(`Release commit ${input.commitSha} is not reachable from ${targetBranch}.`)
  if (input.ciSha !== input.commitSha)
    throw new Error(`Release commit ${input.commitSha} lacks successful protected-branch push CI.`)
  if (input.tagSha !== input.commitSha)
    throw new Error(`Publication requires ${expectedTag} to point to ${input.commitSha}.`)

  return {
    channel,
    commitSha: input.commitSha,
    npmTag,
    prerelease,
    tag: expectedTag,
    targetBranch,
    version: input.packageVersion,
  }
}

if (import.meta.main) {
  const identity = await resolveReleaseIdentity()
  await writeGithubOutputs(identity)
  console.log(JSON.stringify(identity))
}

async function resolveReleaseIdentity(): Promise<ReleaseIdentity> {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version?: string
  }
  const packageVersion = manifest.version ?? ''
  const requestedBranch = 'main'
  const requestedTag = process.env.GITHUB_REF_NAME ?? ''
  const commitSha = await git(['rev-parse', 'HEAD'])
  const branchHeadSha = await git(['rev-parse', `origin/${requestedBranch}`])
  const commitTitle = await git(['log', '-1', '--pretty=%s', commitSha])
  const branchContainsSha = await isAncestor(commitSha, branchHeadSha)
  const tagSha = await readTagSha(requestedTag)
  const ciSha = await findSuccessfulProtectedBranchCiSha({ branch: requestedBranch, sha: commitSha })

  return validateReleaseIdentity({
    branchContainsSha,
    branchHeadSha,
    ciSha,
    commitSha,
    commitTitle,
    packageVersion,
    requestedBranch,
    requestedTag,
    tagSha,
  })
}

export async function findSuccessfulProtectedBranchCiSha(input: {
  branch: string
  sha: string
}): Promise<string | null> {
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (!repository) throw new Error('GITHUB_REPOSITORY is required.')
  if (!token) throw new Error('GITHUB_TOKEN or GH_TOKEN is required.')

  const apiBaseUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const url = new URL(`${apiBaseUrl}/repos/${repository}/actions/workflows/ci.yml/runs`)
  url.searchParams.set('branch', input.branch)
  url.searchParams.set('event', 'push')
  url.searchParams.set('head_sha', input.sha)
  url.searchParams.set('status', 'completed')
  url.searchParams.set('per_page', '100')
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!response.ok) throw new Error(`Unable to inspect protected-branch CI: ${response.status} ${response.statusText}`)
  const payload = (await response.json()) as {
    workflow_runs?: Array<{ conclusion?: string; head_branch?: string; head_sha?: string }>
  }
  return (
    payload.workflow_runs?.find(
      run => run.conclusion === 'success' && run.head_branch === input.branch && run.head_sha === input.sha,
    )?.head_sha ?? null
  )
}

async function readTagSha(tag: string): Promise<string | null> {
  try {
    return await git(['rev-list', '-n', '1', `refs/tags/${tag}`])
  } catch {
    return null
  }
}

async function isAncestor(sha: string, branchHeadSha: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['merge-base', '--is-ancestor', sha, branchHeadSha])
    return true
  } catch {
    return false
  }
}

async function git(args: string[]): Promise<string> {
  return (await execFileAsync('git', args)).stdout.trim()
}

async function writeGithubOutputs(identity: ReleaseIdentity): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) return
  await appendFile(
    outputPath,
    [
      `channel=${identity.channel}`,
      `commit_sha=${identity.commitSha}`,
      `npm_tag=${identity.npmTag}`,
      `prerelease=${String(identity.prerelease)}`,
      `tag=${identity.tag}`,
      `target_branch=${identity.targetBranch}`,
      `version=${identity.version}`,
      '',
    ].join('\n'),
  )
}
