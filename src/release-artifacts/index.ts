import { gunzipSync } from 'node:zlib'

export type ReleaseChannel = 'beta' | 'stable'

export interface ReleaseArtifactTarget {
  arch: 'arm64' | 'x64'
  platform: 'darwin' | 'linux' | 'win32'
}

export interface ReleaseManifestAsset extends ReleaseArtifactTarget {
  checksum: string
  downloadUrl: string
  name: string
  size: number
}

export interface ReleaseManifest {
  assets: ReleaseManifestAsset[]
  channel: ReleaseChannel
  version: string
}

export const REQUIRED_RELEASE_BINARY_NAMES = [
  'quantex-darwin-arm64',
  'quantex-darwin-x64',
  'quantex-linux-arm64',
  'quantex-linux-x64',
  'quantex-windows-x64.exe',
] as const

export const REQUIRED_RELEASE_ASSET_NAMES = REQUIRED_RELEASE_BINARY_NAMES.map(getReleaseArchiveName)

export function getReleaseArchiveName(binaryName: string): `${string}.tar.gz` {
  return `${binaryName}.tar.gz`
}

export function getReleaseBinaryName(assetName: string): string | undefined {
  if (!assetName.endsWith('.tar.gz')) return undefined

  const binaryName = assetName.slice(0, -'.tar.gz'.length)
  return parseBinaryTarget(binaryName) ? binaryName : undefined
}

export function formatChecksums(entries: Array<{ checksum: string; name: string }>): string {
  return `${entries
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(entry => `${entry.checksum}  ${entry.name}`)
    .join('\n')}\n`
}

export function parseChecksums(contents: string): Map<string, string> {
  const checksums = new Map<string, string>()

  for (const line of contents.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    const [checksum, fileName] = trimmedLine.split(/\s+/, 2)
    const normalizedFileName = fileName?.replace(/^\*/, '')

    if (checksum && normalizedFileName) checksums.set(normalizedFileName, checksum)
  }

  return checksums
}

export function parseBinaryTarget(name: string): ReleaseArtifactTarget | undefined {
  const binaryName = getReleaseBinaryName(name) ?? name
  const match = binaryName.match(/^quantex-(darwin|linux|windows)-(arm64|x64)(?:\.exe)?$/)
  if (!match) return undefined

  return {
    arch: match[2] === 'arm64' ? 'arm64' : 'x64',
    platform: match[1] === 'windows' ? 'win32' : match[1] === 'darwin' ? 'darwin' : 'linux',
  }
}

export function normalizeRepositoryUrl(repositoryUrl?: string): string {
  if (!repositoryUrl) return 'https://github.com/Drswith/quantex-cli'

  if (repositoryUrl.startsWith('git+')) return repositoryUrl.slice(4).replace(/\.git$/, '')

  if (repositoryUrl.startsWith('git@github.com:'))
    return repositoryUrl.replace('git@github.com:', 'https://github.com/').replace(/\.git$/, '')

  return repositoryUrl.replace(/\.git$/, '')
}

export function resolveReleaseChannel(version: string): ReleaseChannel {
  return version.includes('beta') ? 'beta' : 'stable'
}

export function createReleaseManifest(input: {
  checksums: Map<string, string>
  files: Array<{ name: string; size: number }>
  repositoryUrl?: string
  version: string
}): ReleaseManifest {
  const repositoryUrl = normalizeRepositoryUrl(input.repositoryUrl)
  const channel = resolveReleaseChannel(input.version)
  const assets = input.files
    .map(file => {
      const target = parseBinaryTarget(file.name)
      if (!target) return undefined

      const checksum = input.checksums.get(file.name)
      if (!checksum) throw new Error(`Missing checksum entry for ${file.name}.`)

      if (!getReleaseBinaryName(file.name))
        throw new Error(`Release asset is not a compressed binary archive: ${file.name}.`)

      return {
        arch: target.arch,
        checksum,
        downloadUrl: `${repositoryUrl}/releases/download/v${input.version}/${file.name}`,
        name: file.name,
        platform: target.platform,
        size: file.size,
      } satisfies ReleaseManifestAsset
    })
    .filter((asset): asset is ReleaseManifestAsset => asset !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name))

  if (assets.length === 0) throw new Error('No release binaries were found when creating manifest.json.')

  return {
    assets,
    channel,
    version: input.version,
  }
}

export function validateReleaseManifest(manifest: ReleaseManifest, checksums: Map<string, string>): void {
  if (manifest.assets.length === 0) throw new Error('manifest.json must contain at least one binary asset.')

  const assetNames = new Set(manifest.assets.map(asset => asset.name))

  for (const requiredName of REQUIRED_RELEASE_ASSET_NAMES) {
    if (!assetNames.has(requiredName))
      throw new Error(`manifest.json is missing required release asset: ${requiredName}.`)
  }

  for (const asset of manifest.assets) {
    const expectedChecksum = checksums.get(asset.name)

    if (!expectedChecksum)
      throw new Error(`manifest.json references ${asset.name}, but it is missing from SHA256SUMS.txt.`)

    if (asset.checksum !== expectedChecksum) throw new Error(`manifest.json checksum mismatch for ${asset.name}.`)

    if (!parseBinaryTarget(asset.name))
      throw new Error(`manifest.json contains an invalid binary asset name: ${asset.name}.`)
  }
}

export function extractReleaseArchive(archive: Uint8Array, expectedBinaryName: string): Uint8Array {
  if (getReleaseBinaryName(getReleaseArchiveName(expectedBinaryName)) !== expectedBinaryName)
    throw new Error(`Invalid expected release binary name: ${expectedBinaryName}.`)

  let contents: Uint8Array
  try {
    contents = gunzipSync(archive)
  } catch (error) {
    throw new Error('Release archive is not a valid gzip stream.', { cause: error })
  }

  let offset = 0
  let extracted: Uint8Array | undefined
  while (offset + 512 <= contents.length) {
    const header = contents.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break

    const name = readTarString(header.subarray(0, 100))
    const prefix = readTarString(header.subarray(345, 500))
    const entryName = prefix ? `${prefix}/${name}` : name
    const type = header[156]
    const size = readTarSize(header.subarray(124, 136))
    const bodyStart = offset + 512
    const bodyEnd = bodyStart + size

    if (!name || bodyEnd > contents.length) throw new Error('Release archive contains an invalid tar entry.')
    if (type !== 0 && type !== '0'.charCodeAt(0)) throw new Error('Release archive must contain only a regular file.')
    if (entryName !== expectedBinaryName || extracted)
      throw new Error(`Release archive must contain exactly ${expectedBinaryName}.`)

    extracted = contents.slice(bodyStart, bodyEnd)
    offset = bodyStart + Math.ceil(size / 512) * 512
  }

  if (!extracted) throw new Error(`Release archive does not contain ${expectedBinaryName}.`)
  return extracted
}

function readTarString(bytes: Uint8Array): string {
  const zero = bytes.indexOf(0)
  return new TextDecoder().decode(zero === -1 ? bytes : bytes.subarray(0, zero))
}

function readTarSize(bytes: Uint8Array): number {
  const value = readTarString(bytes).trim()
  if (!/^[0-7]+$/u.test(value)) throw new Error('Release archive contains an invalid tar size.')

  const size = Number.parseInt(value, 8)
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('Release archive contains an unsafe tar size.')
  return size
}
