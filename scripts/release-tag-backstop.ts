import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'
import { findSuccessfulProtectedBranchCiSha } from './release-seal-contract.js'

const execFileAsync = promisify(execFile)
const releaseVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const pendingAutoreleaseLabel = 'autorelease: pending'
const taggedAutoreleaseLabel = 'autorelease: tagged'

export interface ReleaseTagBackstopInput {
  branch: string
  branchHeadSha: string
  commitTitle: string
  packageVersion: string
  tagSha: string | null
  ciSha: string | null
}

export type ReleaseTagBackstopAction = 'noop' | 'relabel-only' | 'tag'

export interface ReleaseTagBackstopPlan {
  action: ReleaseTagBackstopAction
  reason: string
  tag?: string
  version?: string
}

export function parseReleaseVersionFromTitle(title: string): string | null {
  const match = title.match(/^chore: release (.+)$/)
  return match ? match[1].trim() : null
}

export function resolveReleaseTagBackstopPlan(input: ReleaseTagBackstopInput): ReleaseTagBackstopPlan {
  const version = input.packageVersion.trim()
  if (!releaseVersionPattern.test(version)) {
    return { action: 'noop', reason: `package version is not a release version: ${version}` }
  }

  const titleVersion = parseReleaseVersionFromTitle(input.commitTitle)
  if (titleVersion !== version) {
    return { action: 'noop', reason: 'branch head is not a release commit' }
  }

  const tag = `v${version}`
  if (input.tagSha === input.branchHeadSha) {
    return { action: 'relabel-only', reason: 'release tag already points at branch head', tag, version }
  }

  if (input.tagSha) {
    throw new Error(`Tag ${tag} points at ${input.tagSha}, but branch head is ${input.branchHeadSha}.`)
  }

  if (input.ciSha !== input.branchHeadSha) {
    throw new Error(`Release commit ${input.branchHeadSha} lacks successful protected-branch push CI.`)
  }

  return { action: 'tag', reason: 'release tag missing for validated release commit', tag, version }
}

if (import.meta.main) {
  await runReleaseTagBackstop()
}

async function runReleaseTagBackstop(): Promise<void> {
  const branch = process.env.TARGET_BRANCH ?? process.env.GITHUB_REF_NAME ?? ''
  if (branch !== 'main' && branch !== 'beta') {
    console.log(`Release tag backstop skipped for branch ${branch || '<unknown>'}.`)
    return
  }

  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
  if (!token) throw new Error('GH_TOKEN or GITHUB_TOKEN is required.')

  await git(['fetch', '--force', 'origin', branch, '--tags'])

  const branchHeadSha = await git(['rev-parse', `origin/${branch}`])
  const commitTitle = await git(['log', '-1', '--pretty=%s', branchHeadSha])
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version?: string
  }
  const packageVersion = packageJson.version ?? ''
  const tag = packageVersion ? `v${packageVersion}` : ''
  const tagSha = tag ? await readTagSha(tag) : null
  const ciSha = await waitForSuccessfulCi({ branch, sha: branchHeadSha, token })

  const plan = resolveReleaseTagBackstopPlan({
    branch,
    branchHeadSha,
    commitTitle,
    packageVersion,
    tagSha,
    ciSha,
  })

  console.log(`Release tag backstop plan: ${plan.action} (${plan.reason})`)

  if (plan.action === 'noop') return

  if (plan.action === 'tag' && plan.tag) {
    await git(['tag', plan.tag, branchHeadSha])
    const repository = process.env.GITHUB_REPOSITORY
    if (!repository) throw new Error('GITHUB_REPOSITORY is required.')
    const remoteUrl = `https://x-access-token:${token}@github.com/${repository}.git`
    await execFileAsync('git', ['push', remoteUrl, `refs/tags/${plan.tag}`])
    console.log(`Pushed tag ${plan.tag} at ${branchHeadSha}.`)
  }

  await relabelPendingReleasePullRequest({ branch, token })

  if (plan.action === 'tag' && plan.tag) {
    // workflow_dispatch is allowed for GITHUB_TOKEN; the release App token may lack Actions write.
    const dispatchToken = process.env.GITHUB_TOKEN ?? token
    await dispatchReleaseWorkflow({ tag: plan.tag, token: dispatchToken })
  }
}

async function waitForSuccessfulCi(input: { branch: string; sha: string; token: string }): Promise<string | null> {
  const maxWaitMs = Number.parseInt(process.env.RELEASE_TAG_BACKSTOP_MAX_WAIT_MS ?? '900000', 10)
  const pollIntervalMs = Number.parseInt(process.env.RELEASE_TAG_BACKSTOP_POLL_MS ?? '30000', 10)
  const previousToken = process.env.GITHUB_TOKEN
  process.env.GITHUB_TOKEN = input.token

  try {
    const startedAt = Date.now()
    while (Date.now() - startedAt <= maxWaitMs) {
      const ciSha = await findSuccessfulProtectedBranchCiSha({ branch: input.branch, sha: input.sha })
      if (ciSha) return ciSha
      await sleep(pollIntervalMs)
    }

    return null
  } finally {
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = previousToken
  }
}

async function dispatchReleaseWorkflow(input: { tag: string; token: string }): Promise<void> {
  const repository = process.env.GITHUB_REPOSITORY
  if (!repository) throw new Error('GITHUB_REPOSITORY is required.')

  const apiBaseUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const dispatchUrl = new URL(`${apiBaseUrl}/repos/${repository}/actions/workflows/release.yml/dispatches`)
  await githubApiFetch(dispatchUrl, input.token, {
    method: 'POST',
    body: JSON.stringify({ ref: input.tag }),
  })
  console.log(`Dispatched Release workflow for ${input.tag}.`)
}

async function relabelPendingReleasePullRequest(input: { branch: string; token: string }): Promise<void> {
  const repository = process.env.GITHUB_REPOSITORY
  if (!repository) throw new Error('GITHUB_REPOSITORY is required.')

  const apiBaseUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const listUrl = new URL(`${apiBaseUrl}/repos/${repository}/pulls`)
  listUrl.searchParams.set('state', 'closed')
  listUrl.searchParams.set('base', input.branch)
  listUrl.searchParams.set('per_page', '20')

  const response = await githubApiFetch(listUrl, input.token)
  const pulls = (await response.json()) as Array<{
    labels?: Array<{ name?: string }>
    merged_at?: string | null
    number?: number
  }>
  const pendingPull = pulls
    .filter(pull => pull.merged_at)
    .find(pull => pull.labels?.some(label => label.name === pendingAutoreleaseLabel))

  if (!pendingPull?.number) {
    console.log('No merged release PR with autorelease: pending label found.')
    return
  }

  const editUrl = new URL(
    `${apiBaseUrl}/repos/${repository}/issues/${pendingPull.number}/labels/${encodeURIComponent(pendingAutoreleaseLabel)}`,
  )
  const removeResponse = await fetch(editUrl, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${input.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!removeResponse.ok && removeResponse.status !== 404) {
    throw new Error(
      `Unable to remove ${pendingAutoreleaseLabel} from release PR #${pendingPull.number}: ${removeResponse.status}`,
    )
  }

  const addUrl = new URL(`${apiBaseUrl}/repos/${repository}/issues/${pendingPull.number}/labels`)
  const addResponse = await githubApiFetch(addUrl, input.token, {
    method: 'POST',
    body: JSON.stringify([taggedAutoreleaseLabel]),
  })
  if (!addResponse.ok) {
    throw new Error(`Unable to relabel release PR #${pendingPull.number}: ${addResponse.status}`)
  }

  console.log(`Relabeled release PR #${pendingPull.number} to ${taggedAutoreleaseLabel}.`)
}

async function readTagSha(tag: string): Promise<string | null> {
  try {
    return await git(['rev-list', '-n', '1', `refs/tags/${tag}`])
  } catch {
    return null
  }
}

async function git(args: string[]): Promise<string> {
  return (await execFileAsync('git', args)).stdout.trim()
}

async function githubApiFetch(url: URL, token: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText} ${url}`)
  }

  return response
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
