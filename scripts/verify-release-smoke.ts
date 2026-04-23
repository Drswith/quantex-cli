import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { BUILD_VERSION } from '../src/generated/build-meta'
import { parseChecksums } from '../src/release-artifacts'

interface ReleaseManifest {
  assets: Array<{
    checksum: string
    name: string
  }>
  channel: 'beta' | 'stable'
  version: string
}

const manifestContents = await readFile(new URL('../dist/bin/manifest.json', import.meta.url), 'utf8')
const checksumContents = await readFile(new URL('../dist/bin/SHA256SUMS.txt', import.meta.url), 'utf8')

const manifest = JSON.parse(manifestContents) as ReleaseManifest
const checksums = parseChecksums(checksumContents)
const currentAssetName = getCurrentReleaseAssetName()

if (!currentAssetName)
  throw new Error(`No release smoke target is defined for ${process.platform}/${process.arch}.`)

const currentAsset = manifest.assets.find(asset => asset.name === currentAssetName)
if (!currentAsset)
  throw new Error(`manifest.json does not contain the current runner asset "${currentAssetName}".`)

const checksum = checksums.get(currentAssetName)
if (!checksum)
  throw new Error(`SHA256SUMS.txt does not contain the current runner asset "${currentAssetName}".`)

if (checksum !== currentAsset.checksum)
  throw new Error(`Checksum mismatch for "${currentAssetName}" between manifest.json and SHA256SUMS.txt.`)

if (manifest.version !== BUILD_VERSION)
  throw new Error(`manifest.json version "${manifest.version}" does not match build version "${BUILD_VERSION}".`)

const binaryPath = new URL(`../dist/bin/${currentAssetName}`, import.meta.url)
const proc = Bun.spawn([binaryPath.pathname, '--version'], {
  stdio: ['ignore', 'pipe', 'pipe'] as const,
})

const [stdout, stderr, exitCode] = await Promise.all([
  proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(''),
  proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(''),
  proc.exited,
])

if (exitCode !== 0) {
  throw new Error(`Release smoke check failed for "${currentAssetName}" with exit code ${exitCode}: ${stderr.trim() || 'no stderr output'}`)
}

if (!stdout.includes(BUILD_VERSION)) {
  throw new Error(`Release smoke check for "${currentAssetName}" did not report version "${BUILD_VERSION}". Output was: ${stdout.trim() || '(empty)'}`)
}

console.log(`Release smoke check passed for ${currentAssetName} (${BUILD_VERSION}).`)

function getCurrentReleaseAssetName(): string | undefined {
  if (process.platform === 'darwin') {
    if (process.arch === 'arm64')
      return 'quantex-darwin-arm64'

    if (process.arch === 'x64')
      return 'quantex-darwin-x64'
  }

  if (process.platform === 'linux') {
    if (process.arch === 'arm64')
      return 'quantex-linux-arm64'

    if (process.arch === 'x64')
      return 'quantex-linux-x64'
  }

  if (process.platform === 'win32' && process.arch === 'x64')
    return 'quantex-windows-x64.exe'

  return undefined
}
