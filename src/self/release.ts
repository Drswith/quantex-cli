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
