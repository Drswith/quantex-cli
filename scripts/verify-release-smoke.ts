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

if (!currentAssetName) throw new Error(`No release smoke target is defined for ${process.platform}/${process.arch}.`)

const currentAsset = manifest.assets.find(asset => asset.name === currentAssetName)
if (!currentAsset) throw new Error(`manifest.json does not contain the current runner asset "${currentAssetName}".`)

const checksum = checksums.get(currentAssetName)
if (!checksum) throw new Error(`SHA256SUMS.txt does not contain the current runner asset "${currentAssetName}".`)

if (checksum !== currentAsset.checksum)
  throw new Error(`Checksum mismatch for "${currentAssetName}" between manifest.json and SHA256SUMS.txt.`)

if (manifest.version !== BUILD_VERSION)
  throw new Error(`manifest.json version "${manifest.version}" does not match build version "${BUILD_VERSION}".`)

const binaryPath = new URL(`../dist/bin/${currentAssetName}`, import.meta.url)
const versionOutput = await runBinary(binaryPath.pathname, ['--version'])

if (versionOutput.exitCode !== 0) {
  throw new Error(
    `Release smoke check failed for "${currentAssetName}" with exit code ${versionOutput.exitCode}: ${versionOutput.stderr.trim() || 'no stderr output'}`,
  )
}

if (!versionOutput.stdout.includes(BUILD_VERSION)) {
  throw new Error(
    `Release smoke check for "${currentAssetName}" did not report version "${BUILD_VERSION}". Output was: ${versionOutput.stdout.trim() || '(empty)'}`,
  )
}

const listOutput = await runBinary(binaryPath.pathname, ['--color', 'never', '--output', 'json', 'list'])
if (listOutput.exitCode !== 0) {
  throw new Error(
    `Release list smoke check failed for "${currentAssetName}" with exit code ${listOutput.exitCode}: ${listOutput.stderr.trim() || 'no stderr output'}`,
  )
}
if (Buffer.byteLength(listOutput.stdout) <= 8 * 1024) {
  throw new Error(`Release list smoke check for "${currentAssetName}" did not exercise a multi-chunk stdout pipe.`)
}

let listResult: { action?: unknown; ok?: unknown }
try {
  listResult = JSON.parse(listOutput.stdout) as { action?: unknown; ok?: unknown }
} catch (error) {
  throw new Error(`Release list smoke check for "${currentAssetName}" emitted incomplete JSON.`, { cause: error })
}
if (listResult.action !== 'list' || listResult.ok !== true) {
  throw new Error(`Release list smoke check for "${currentAssetName}" emitted an invalid result envelope.`)
}

console.log(`Release smoke check passed for ${currentAssetName} (${BUILD_VERSION}).`)

async function runBinary(
  executable: string,
  args: readonly string[],
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  const proc = Bun.spawn([executable, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'] as const,
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(''),
    proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(''),
    proc.exited,
  ])

  return { exitCode, stderr, stdout }
}

function getCurrentReleaseAssetName(): string | undefined {
  if (process.platform === 'darwin') {
    if (process.arch === 'arm64') return 'quantex-darwin-arm64'

    if (process.arch === 'x64') return 'quantex-darwin-x64'
  }

  if (process.platform === 'linux') {
    if (process.arch === 'arm64') return 'quantex-linux-arm64'

    if (process.arch === 'x64') return 'quantex-linux-x64'
  }

  if (process.platform === 'win32' && process.arch === 'x64') return 'quantex-windows-x64.exe'

  return undefined
}
