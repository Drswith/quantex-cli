import type { SelfUpdateChannel } from './types'
import { basename } from 'node:path'
import process from 'node:process'
import { BUILD_REPOSITORY_URL } from '../generated/build-meta'
import { fetchJsonWithCache, fetchTextWithCache } from '../utils/network'

export interface BinaryReleaseAsset {
  arch: 'arm64' | 'x64'
  checksum: string
  downloadUrl: string
  name: string
  platform: 'darwin' | 'linux' | 'win32'
  size?: number
}

export interface BinaryReleaseManifest {
  assets: BinaryReleaseAsset[]
  channel: SelfUpdateChannel
  version: string
}

interface GitHubReleaseAsset {
  browser_download_url: string
  name: string
}

interface GitHubReleaseSummary {
  assets: GitHubReleaseAsset[]
  prerelease: boolean
  tag_name: string
}

export function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').toLowerCase()
}

export function getBinaryReleaseAssetName(executablePath: string = process.execPath): string | undefined {
  const normalizedPath = normalizePath(executablePath)
  const executableName = basename(normalizedPath)

  if (executableName.endsWith('.exe'))
    return 'quantex-windows-x64.exe'

  if (process.platform === 'darwin')
    return process.arch === 'arm64' ? 'quantex-darwin-arm64' : 'quantex-darwin-x64'

  if (process.platform === 'linux')
    return process.arch === 'arm64' ? 'quantex-linux-arm64' : 'quantex-linux-x64'

  return undefined
}

export function getBinaryReleaseDownloadUrl(executablePath: string = process.execPath): string | undefined {
  const assetName = getBinaryReleaseAssetName(executablePath)
  if (!assetName || !BUILD_REPOSITORY_URL)
    return undefined

  return `${BUILD_REPOSITORY_URL}/releases/latest/download/${assetName}`
}

export function getBinaryReleaseChecksumUrl(): string | undefined {
  if (!BUILD_REPOSITORY_URL)
    return undefined

  return `${BUILD_REPOSITORY_URL}/releases/latest/download/SHA256SUMS.txt`
}

export function getSelfUpdateChannel(
  requestedChannel?: SelfUpdateChannel,
  configuredChannel?: SelfUpdateChannel,
  env: NodeJS.ProcessEnv = process.env,
): SelfUpdateChannel {
  if (requestedChannel)
    return requestedChannel

  if (env.QUANTEX_UPDATE_CHANNEL === 'beta')
    return 'beta'

  if (env.QUANTEX_UPDATE_CHANNEL === 'stable')
    return 'stable'

  return configuredChannel === 'beta' ? 'beta' : 'stable'
}

export async function fetchBinaryReleaseChecksum(assetName: string): Promise<string> {
  const checksumUrl = getBinaryReleaseChecksumUrl()

  if (!checksumUrl)
    throw new Error('No checksum file is available for the current release source.')

  const checksumContents = await fetchTextWithCache(checksumUrl, 'self:checksum')
  if (!checksumContents)
    throw new Error('Failed to download checksum file.')

  const checksum = parseBinaryReleaseChecksum(checksumContents, assetName)

  if (!checksum)
    throw new Error(`No checksum entry was found for ${assetName}.`)

  return checksum
}

export async function fetchBinaryReleaseManifest(channel: SelfUpdateChannel): Promise<BinaryReleaseManifest> {
  const manifestUrl = await resolveBinaryReleaseManifestUrl(channel)
  const manifest = await fetchJsonWithCache<BinaryReleaseManifest>(manifestUrl, `self:manifest:${channel}`)

  if (!manifest)
    throw new Error('Failed to download release manifest.')

  return manifest
}

export async function resolveBinaryReleaseManifestUrl(channel: SelfUpdateChannel): Promise<string> {
  if (!BUILD_REPOSITORY_URL)
    throw new Error('No repository URL is configured for Quantex releases.')

  if (channel === 'stable')
    return `${BUILD_REPOSITORY_URL}/releases/latest/download/manifest.json`

  const release = await fetchGitHubReleaseSummary(channel)
  const manifestAsset = release.assets.find(asset => asset.name === 'manifest.json')

  if (!manifestAsset?.browser_download_url)
    throw new Error(`No manifest.json asset was found for the ${channel} release channel.`)

  return manifestAsset.browser_download_url
}

export async function fetchGitHubReleaseSummary(channel: SelfUpdateChannel): Promise<GitHubReleaseSummary> {
  const repositorySlug = getRepositorySlug()

  if (!repositorySlug)
    throw new Error('Failed to resolve the GitHub repository slug for Quantex releases.')

  const releases = await fetchJsonWithCache<GitHubReleaseSummary[]>(
    `https://api.github.com/repos/${repositorySlug}/releases?per_page=20`,
    'self:github-releases',
  )

  if (!releases)
    throw new Error('Failed to query GitHub releases.')

  const release = releases.find(item => channel === 'beta' ? item.prerelease : !item.prerelease)

  if (!release)
    throw new Error(`No GitHub release was found for the ${channel} channel.`)

  return release
}

export function parseBinaryReleaseChecksum(contents: string, assetName: string): string | undefined {
  for (const line of contents.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (!trimmedLine)
      continue

    const [checksum, rawFilename] = trimmedLine.split(/\s+/, 2)
    const filename = rawFilename?.replace(/^\*/, '')

    if (checksum?.length === 64 && filename === assetName)
      return checksum.toLowerCase()
  }

  return undefined
}

export function resolveBinaryReleaseAsset(
  manifest: BinaryReleaseManifest,
  executablePath: string = process.execPath,
): BinaryReleaseAsset | undefined {
  const platform = process.platform
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const currentAssetName = getBinaryReleaseAssetName(executablePath)

  return manifest.assets.find(asset =>
    asset.platform === platform
    && asset.arch === arch
    && (!currentAssetName || asset.name === currentAssetName),
  )
}

function getRepositorySlug(): string | undefined {
  if (!BUILD_REPOSITORY_URL)
    return undefined

  const match = BUILD_REPOSITORY_URL.match(/github\.com\/([^/]+\/[^/]+)$/)
  return match?.[1]
}
