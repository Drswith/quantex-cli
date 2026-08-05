import type { createReleaseManifest } from '../../src/release-artifacts'
import { createHash } from 'node:crypto'
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  createReleaseManifest as buildReleaseManifest,
  formatChecksums,
  getReleaseArchiveName,
  getReleaseBinaryName,
  normalizeRepositoryUrl,
  parseChecksums,
  REQUIRED_RELEASE_BINARY_NAMES,
  validateReleaseManifest,
} from '../../src/release-artifacts'

interface PackageJsonShape {
  name?: string
  repository?: string | { url?: string }
  version?: string
}

const binDir = fileURLToPath(new URL('../../dist/bin/', import.meta.url))
const checksumsPath = join(binDir, 'SHA256SUMS.txt')
const manifestPath = join(binDir, 'manifest.json')

await compressBinaries()
await writeChecksums()
await writeManifest()
await verifyArtifacts()

async function compressBinaries(): Promise<void> {
  const availableFiles = new Set(await readdir(binDir))

  for (const binaryName of REQUIRED_RELEASE_BINARY_NAMES) {
    if (!availableFiles.has(binaryName)) throw new Error(`Missing release binary: ${binaryName}.`)

    const archivePath = join(binDir, getReleaseArchiveName(binaryName))
    await rm(archivePath, { force: true })
    await runChecked(['tar', '--format=ustar', '-czf', archivePath, '-C', binDir, binaryName])
  }
}

async function writeChecksums(): Promise<void> {
  const files = (await readdir(binDir))
    .filter(name => getReleaseBinaryName(name) !== undefined)
    .sort((left, right) => left.localeCompare(right))

  if (files.length === 0) throw new Error('No release binaries were found when generating SHA256SUMS.txt.')

  const checksums = await Promise.all(
    files.map(async name => ({
      checksum: createHash('sha256')
        .update(await readFile(join(binDir, name)))
        .digest('hex'),
      name,
    })),
  )

  await writeFile(checksumsPath, formatChecksums(checksums), 'utf8')
}

async function writeManifest(): Promise<void> {
  const packageJson = (await Bun.file(new URL('../../package.json', import.meta.url)).json()) as PackageJsonShape
  const version = packageJson.version ?? '0.0.0'
  const checksums = parseChecksums(await readFile(checksumsPath, 'utf8'))
  const binaryFiles = await Promise.all(
    (await readdir(binDir))
      .filter(name => getReleaseBinaryName(name) !== undefined)
      .map(async name => ({
        name,
        size: (await stat(join(binDir, name))).size,
      })),
  )
  const manifest = buildReleaseManifest({
    checksums,
    files: binaryFiles,
    repositoryUrl: normalizeRepositoryUrl(
      typeof packageJson.repository === 'string' ? packageJson.repository : packageJson.repository?.url,
    ),
    version,
  })

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

async function verifyArtifacts(): Promise<void> {
  const checksums = parseChecksums(await readFile(checksumsPath, 'utf8'))
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ReturnType<typeof createReleaseManifest>

  validateReleaseManifest(manifest, checksums)
}

async function runChecked(command: string[]): Promise<void> {
  const child = Bun.spawn(command, {
    env: { ...process.env, COPYFILE_DISABLE: '1' },
    stderr: 'inherit',
    stdout: 'inherit',
  })
  const exitCode = await child.exited
  if (exitCode !== 0) throw new Error(`Command failed with exit code ${exitCode}: ${command.join(' ')}`)
}
