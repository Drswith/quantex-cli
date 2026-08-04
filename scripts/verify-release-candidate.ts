import type { ReleaseCandidateManifest } from './stage-release-candidate'
import { execFile } from 'node:child_process'
import { appendFile, readFile } from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'
import { verifyReleaseCandidate } from './stage-release-candidate'

const execFileAsync = promisify(execFile)

export interface NpmPublicationState {
  integrity?: string
  published: boolean
}

export interface ReleaseAssetsPayload {
  assets?: Array<{ digest?: string; name?: string; size?: number }>
  tagName?: string
}

const usage =
  'Usage: bun run scripts/verify-release-candidate.ts <download-check|npm-state|assets-check|registry-closure> [candidate-root]'

if (import.meta.main) {
  const [subcommand, candidateRoot = 'release-candidate'] = process.argv.slice(2)

  switch (subcommand) {
    case 'download-check':
      await downloadCheck(candidateRoot)
      break
    case 'npm-state':
      await npmState()
      break
    case 'assets-check':
      await assetsCheck(candidateRoot)
      break
    case 'registry-closure':
      await registryClosure(candidateRoot)
      break
    default:
      throw new Error(usage)
  }
}

export async function downloadCheck(candidateRoot: string): Promise<void> {
  const expectedTag = requiredEnv('RELEASE_TAG')
  const expectedVersion = requiredEnv('RELEASE_VERSION')
  const manifest = await verifyReleaseCandidate(candidateRoot)

  if (manifest.tag !== expectedTag || manifest.version !== expectedVersion) {
    throw new Error('Downloaded candidate identity does not match the validated release job outputs.')
  }

  console.log(`Downloaded candidate ${manifest.tag} matches candidate.json hashes.`)
}

async function npmState(): Promise<void> {
  const version = requiredEnv('RELEASE_VERSION')
  const state = await resolveNpmPublicationState(version)

  await writeGithubOutputs([
    `published=${String(state.published)}`,
    ...(state.integrity ? [`integrity=${state.integrity}`] : []),
  ])
  console.log(JSON.stringify(state))
}

async function assetsCheck(candidateRoot: string): Promise<void> {
  const tag = requiredEnv('RELEASE_TAG')
  const manifest = await readCandidateManifest(candidateRoot)
  const { stdout } = await execFileAsync('gh', ['release', 'view', tag, '--json', 'assets,tagName'])
  const release = JSON.parse(stdout) as ReleaseAssetsPayload

  verifyCandidateAssets(manifest, release)
  console.log(`GitHub Release ${tag} assets match candidate.json.`)
}

async function registryClosure(candidateRoot: string): Promise<void> {
  const version = requiredEnv('RELEASE_VERSION')
  const manifest = await readCandidateManifest(candidateRoot)
  const maxAttempts = Number.parseInt(process.env.RELEASE_REGISTRY_CLOSURE_ATTEMPTS ?? '12', 10)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const state = await resolveNpmPublicationState(version)
    if (state.published && state.integrity === manifest.npm.integrity) {
      console.log(`npm registry integrity converged for quantex-cli@${version}.`)
      return
    }
    if (attempt < maxAttempts) await sleep(5000)
  }

  throw new Error('npm registry integrity did not converge to the validated candidate.')
}

export async function resolveNpmPublicationState(version: string): Promise<NpmPublicationState> {
  try {
    const { stdout } = await execFileAsync('npm', ['view', `quantex-cli@${version}`, 'dist.integrity', '--json'])
    const integrity = stdout.trim().replace(/[\s"]/g, '')
    if (!integrity) throw new Error(`npm view returned an empty integrity for quantex-cli@${version}.`)
    return { integrity, published: true }
  } catch (error) {
    const stderr = errorStderr(error)
    if (/E404|404 Not Found/.test(stderr)) return { published: false }
    throw new Error(`Unable to resolve npm publication state for quantex-cli@${version}: ${stderr}`, { cause: error })
  }
}

export function verifyCandidateAssets(manifest: ReleaseCandidateManifest, release: ReleaseAssetsPayload): void {
  if (release.tagName !== manifest.tag) {
    throw new Error(
      `GitHub Release tag ${release.tagName ?? '<missing>'} does not match the candidate ${manifest.tag}.`,
    )
  }

  const assets = new Map((release.assets ?? []).flatMap(asset => (asset.name ? [[asset.name, asset]] : [])))
  for (const asset of manifest.assets) {
    const uploaded = assets.get(asset.name)
    if (uploaded?.size !== asset.size || uploaded.digest !== `sha256:${asset.sha256}`) {
      throw new Error(`GitHub Release asset is missing or does not match: ${asset.name}`)
    }
  }
}

async function readCandidateManifest(candidateRoot: string): Promise<ReleaseCandidateManifest> {
  return JSON.parse(await readFile(`${candidateRoot}/candidate.json`, 'utf8')) as ReleaseCandidateManifest
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function errorStderr(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'stderr' in error && typeof error.stderr === 'string') {
    return error.stderr
  }
  return String(error)
}

async function writeGithubOutputs(lines: string[]): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) return
  await appendFile(outputPath, `${lines.join('\n')}\n`)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
