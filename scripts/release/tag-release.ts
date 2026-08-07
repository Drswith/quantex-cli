import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'
import { findSuccessfulProtectedBranchCiSha } from './release-seal-contract'

const execFileAsync = promisify(execFile)
const releaseVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const pendingAutoreleaseLabel = 'autorelease: pending'
const taggedAutoreleaseLabel = 'autorelease: tagged'

export interface ReleaseTagInput {
  branch: string
  branchHeadSha: string
  commitTitle: string
  packageVersion: string
  tagSha: string | null
  ciSha: string | null
}

export type ReleaseTagAction = 'noop' | 'relabel-only' | 'tag'

export interface ReleaseTagPlan {
  action: ReleaseTagAction
  reason: string
  tag?: string
  version?: string
}

export function parseReleaseVersionFromTitle(title: string): string | null {
  const match = title.match(/^chore: release (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/)
  return match ? match[1].trim() : null
}

// Decides from the branch head alone, without any network call, whether tagging
// could apply at all. The runner checks this before waiting on CI: the wait can
// last 15 minutes, and spending it on an ordinary push that can never be tagged
// also blocks the next release-please run behind a non-cancelling group.
export function findNonReleaseHeadReason(input: { commitTitle: string; packageVersion: string }): string | null {
  const version = input.packageVersion.trim()
  if (!releaseVersionPattern.test(version)) {
    return `package version is not a release version: ${version}`
  }

  if (parseReleaseVersionFromTitle(input.commitTitle) !== version) {
    return 'branch head is not a release commit'
  }

  return null
}

export function resolveReleaseTagPlan(input: ReleaseTagInput): ReleaseTagPlan {
  const nonReleaseHeadReason = findNonReleaseHeadReason(input)
  if (nonReleaseHeadReason) {
    return { action: 'noop', reason: nonReleaseHeadReason }
  }

  const version = input.packageVersion.trim()
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
  await runReleaseTagging()
}

async function runReleaseTagging(): Promise<void> {
  const branch = process.env.TARGET_BRANCH ?? process.env.GITHUB_REF_NAME ?? ''
  if (branch !== 'main') {
    console.log(`Release tagging skipped for branch ${branch || '<unknown>'}.`)
    return
  }

  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
  if (!token) throw new Error('GH_TOKEN or GITHUB_TOKEN is required.')

  await git(['fetch', '--force', 'origin', branch, '--tags'])

  const branchHeadSha = await git(['rev-parse', `origin/${branch}`])
  const commitTitle = await git(['log', '-1', '--pretty=%s', branchHeadSha])
  const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version?: string
  }
  const packageVersion = packageJson.version ?? ''

  // Answer the free question before the expensive one.
  const nonReleaseHeadReason = findNonReleaseHeadReason({ commitTitle, packageVersion })
  if (nonReleaseHeadReason) {
    console.log(`Release tag plan: noop (${nonReleaseHeadReason})`)
    return
  }

  const tag = packageVersion ? `v${packageVersion}` : ''
  const tagSha = tag ? await readTagSha(tag) : null
  const ciSha = await waitForSuccessfulCi({ branch, sha: branchHeadSha, token })

  const plan = resolveReleaseTagPlan({
    branch,
    branchHeadSha,
    commitTitle,
    packageVersion,
    tagSha,
    ciSha,
  })

  console.log(`Release tag plan: ${plan.action} (${plan.reason})`)

  if (plan.action === 'noop') return

  if (plan.action === 'tag' && plan.tag) {
    await git(['tag', plan.tag, branchHeadSha])
    const repository = process.env.GITHUB_REPOSITORY
    if (!repository) throw new Error('GITHUB_REPOSITORY is required.')
    const remoteUrl = `https://x-access-token:${token}@github.com/${repository}.git`
    await execFileAsync('git', ['push', remoteUrl, `refs/tags/${plan.tag}`])
    console.log(`Pushed tag ${plan.tag} at ${branchHeadSha}.`)
    await dispatchReleaseWorkflow({ tag: plan.tag, token })
  }

  await relabelPendingReleasePullRequest({ branch, token })
}

async function waitForSuccessfulCi(input: { branch: string; sha: string; token: string }): Promise<string | null> {
  const maxWaitMs = Number.parseInt(process.env.RELEASE_TAG_MAX_WAIT_MS ?? '900000', 10)
  const pollIntervalMs = Number.parseInt(process.env.RELEASE_TAG_POLL_MS ?? '30000', 10)
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

// The tag push cannot start publication on its own, so this dispatch is the
// release trigger rather than a fallback. actions/checkout persists the default
// GITHUB_TOKEN as an http.<url>.extraheader credential, which authenticates the
// push before the App token in the push URL is ever consulted, and GitHub does
// not start workflow runs for GITHUB_TOKEN events. Polling for the tag-event run
// only ever burned its full grace period.
async function dispatchReleaseWorkflow(input: { tag: string; token: string }): Promise<void> {
  const repository = process.env.GITHUB_REPOSITORY
  if (!repository) throw new Error('GITHUB_REPOSITORY is required.')

  const apiBaseUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const dispatchUrl = new URL(`${apiBaseUrl}/repos/${repository}/actions/workflows/release.yml/dispatches`)
  // Use GITHUB_TOKEN for the dispatch because the GitHub App token may lack actions:write.
  const dispatchToken = process.env.GITHUB_TOKEN ?? input.token
  await githubApiFetch(dispatchUrl, dispatchToken, {
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
