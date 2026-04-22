import { basename } from 'node:path'
import process from 'node:process'
import { BUILD_REPOSITORY_URL } from '../generated/build-meta'

function normalizePath(path: string): string {
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

export async function fetchBinaryReleaseChecksum(assetName: string): Promise<string> {
  const checksumUrl = getBinaryReleaseChecksumUrl()

  if (!checksumUrl)
    throw new Error('No checksum file is available for the current release source.')

  const response = await fetch(checksumUrl)

  if (!response.ok)
    throw new Error(`Failed to download checksum file: HTTP ${response.status}.`)

  const checksum = parseBinaryReleaseChecksum(await response.text(), assetName)

  if (!checksum)
    throw new Error(`No checksum entry was found for ${assetName}.`)

  return checksum
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
