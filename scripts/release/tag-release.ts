import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'
import { findSuccessfulProtectedBranchCiSha } from './release-seal-contract'

const execFileAsync = promisify(execFile)
const releaseVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const pendingAutoreleaseLabel = 'autorelease: pending'
const taggedAutoreleaseLabel = 'autorelease: tagged'

// How far back on the protected branch a release commit may be found. The
// release commit for the *current* manifest version is always recent; anything
// older was released long ago and is settled by the tag check first. This is a
// guard against walking forever on a hand-edited manifest, not a tuning knob.
const releaseSearchDepth = 200

export interface ReleaseTagInput {
  branch: string
  packageVersion: string
  releaseSha: string | null
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

// Answers from the manifest alone, without any network call, whether tagging
// could apply at all. The runner checks this before waiting on CI: the wait can
// last 15 minutes, and spending it on an ordinary push that can never be tagged
// also blocks the next release-please run behind a non-cancelling group.
export function findUntaggableReason(input: { packageVersion: string; releaseSha: string | null }): string | null {
  const version = input.packageVersion.trim()
  if (!releaseVersionPattern.test(version)) {
    return `package version is not a release version: ${version}`
  }

  if (!input.releaseSha) {
    return `no release commit for ${version} in recent branch history`
  }

  return null
}

export function resolveReleaseTagPlan(input: ReleaseTagInput): ReleaseTagPlan {
  const untaggableReason = findUntaggableReason(input)
  if (untaggableReason) {
    return { action: 'noop', reason: untaggableReason }
  }

  const version = input.packageVersion.trim()
  const tag = `v${version}`
  const releaseSha = input.releaseSha!
  if (input.tagSha === releaseSha) {
    return { action: 'relabel-only', reason: 'release tag already points at the release commit', tag, version }
  }

  if (input.tagSha) {
    throw new Error(`Tag ${tag} points at ${input.tagSha}, but the release commit is ${releaseSha}.`)
  }

  if (input.ciSha !== releaseSha) {
    throw new Error(`Release commit ${releaseSha} lacks successful protected-branch push CI.`)
  }

  return { action: 'tag', reason: 'release tag missing for validated release commit', tag, version }
}

/**
 * Finds the release commit for `version` on the branch.
 *
 * The release commit is not necessarily the branch head: anything merged
 * between the Release PR merge and this job's evaluation sits on top of it.
 * Keying off the head instead stranded v1.9.3, because release-please never
 * tags and every later push re-asked the same head question.
 *
 * `--first-parent` keeps the walk on the protected branch's own history rather
 * than descending into merged side branches, which is the history the release
 * contract reasons about. The match is unique in practice: the manifest version
 * advances only at release commits, so taking the most recent match is exact.
 */
export function findReleaseCommitShaFromLog(input: { log: string; version: string }): string | null {
  const version = input.version.trim()
  for (const line of input.log.split('\n')) {
    const separator = line.indexOf(' ')
    if (separator === -1) continue
    const sha = line.slice(0, separator)
    const title = line.slice(separator + 1)
    if (sha && parseReleaseVersionFromTitle(title) === version) return sha
  }

  return null
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

  const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version?: string
  }
  const packageVersion = packageJson.version ?? ''
  const releaseSha = await findReleaseCommitSha({ branch, version: packageVersion })

  // Answer the free questions before the expensive one: an ordinary push after
  // the release was tagged settles here, without the CI wait.
  const untaggableReason = findUntaggableReason({ packageVersion, releaseSha })
  if (untaggableReason) {
    console.log(`Release tag plan: noop (${untaggableReason})`)
    return
  }

  const tag = `v${packageVersion}`
  const tagSha = await readTagSha(tag)
  const ciSha = tagSha ? null : await waitForSuccessfulCi({ branch, sha: releaseSha!, token })

  const plan = resolveReleaseTagPlan({
    branch,
    ciSha,
    packageVersion,
    releaseSha,
    tagSha,
  })

  console.log(`Release tag plan: ${plan.action} (${plan.reason})`)

  if (plan.action === 'noop') return

  if (plan.action === 'tag' && plan.tag) {
    await git(['tag', plan.tag, releaseSha!])
    const repository = process.env.GITHUB_REPOSITORY
    if (!repository) throw new Error('GITHUB_REPOSITORY is required.')
    const remoteUrl = `https://x-access-token:${token}@github.com/${repository}.git`
    await execFileAsync('git', ['push', remoteUrl, `refs/tags/${plan.tag}`])
    console.log(`Pushed tag ${plan.tag} at ${releaseSha}.`)
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

async function findReleaseCommitSha(input: { branch: string; version: string }): Promise<string | null> {
  if (!releaseVersionPattern.test(input.version.trim())) return null

  const log = await git([
    'log',
    '--first-parent',
    `--max-count=${releaseSearchDepth}`,
    '--pretty=%H %s',
    `origin/${input.branch}`,
  ])
  return findReleaseCommitShaFromLog({ log, version: input.version })
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
