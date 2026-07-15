import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import process from 'node:process'
import { verifyV1DownstreamCompatibility } from './verify-v1-downstream'

interface PackedFile {
  path: string
}

interface PackedPackage {
  files?: PackedFile[]
  filename?: string
}

interface PackageManifest {
  bin?: Record<string, string>
  name?: string
  version?: string
}

interface RootDeclarationContract {
  readonly bytes: number
  readonly sha256: string
}

interface StableCommandProjection {
  data?: { commands?: unknown[] }
  meta?: { schemaVersion?: string; version?: string }
}

const packageManifest = (await Bun.file(join(process.cwd(), 'package.json')).json()) as PackageManifest
await verifyPackageDistribution()

async function verifyPackageDistribution(): Promise<void> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-package-contract-'))
  try {
    const packOutput = await runChecked(['npm', 'pack', '--json', '--pack-destination', tempRoot])
    const packedPackage = parsePackOutput(packOutput)[0]
    if (!packedPackage?.filename) throw new Error('npm pack --json did not return package metadata with a filename.')

    const packedFiles = packedPackage.files ?? []
    const forbiddenFiles = packedFiles.filter(file => file.path.startsWith('dist/bin/'))
    const forbiddenInstallEntrypoints = packedFiles.filter(
      file => file.path === 'scripts/postinstall.cjs' || file.path.startsWith('dist/postinstall.'),
    )
    if (forbiddenFiles.length > 0) {
      throw new Error(
        `Managed-install package unexpectedly includes standalone release artifacts:\n${forbiddenFiles
          .map(file => `- ${file.path}`)
          .join('\n')}`,
      )
    }
    if (forbiddenInstallEntrypoints.length > 0) {
      throw new Error(
        `Managed-install package unexpectedly includes install-time postinstall entrypoints:\n${forbiddenInstallEntrypoints
          .map(file => `- ${file.path}`)
          .join('\n')}`,
      )
    }

    const requiredFiles = ['dist/cli.mjs', 'dist/index.d.mts', 'dist/index.mjs', 'package.json']
    const missingFiles = requiredFiles.filter(requiredPath => !packedFiles.some(file => file.path === requiredPath))
    if (missingFiles.length > 0) {
      throw new Error(`Managed-install package is missing required runtime files:\n${missingFiles.join('\n')}`)
    }

    const binaryNames = Object.keys(packageManifest.bin ?? {}).sort()
    if (JSON.stringify(binaryNames) !== JSON.stringify(['qtx', 'quantex'])) {
      throw new Error(
        `Managed-install package must preserve qtx/quantex bin entries; found ${binaryNames.join(', ') || 'none'}.`,
      )
    }
    const binaryTargets = new Set(Object.values(packageManifest.bin ?? {}))
    if (binaryTargets.size !== 1) {
      throw new Error(`qtx and quantex must resolve to one packaged CLI entry; found ${[...binaryTargets].join(', ')}.`)
    }

    const tarballPath = join(tempRoot, basename(packedPackage.filename))
    const unpackRoot = join(tempRoot, 'unpacked')
    const installRoot = join(tempRoot, 'consumer')
    await mkdir(unpackRoot, { recursive: true })
    await runChecked(['tar', '-xzf', tarballPath, '-C', unpackRoot])
    const installedPackageRoot = join(unpackRoot, 'package')
    await symlink(
      join(process.cwd(), 'node_modules'),
      join(installedPackageRoot, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    await mkdir(join(installRoot, 'node_modules'), { recursive: true })
    await symlink(
      installedPackageRoot,
      join(installRoot, 'node_modules', packageManifest.name ?? ''),
      process.platform === 'win32' ? 'junction' : 'dir',
    )

    const binaryProjections = await Promise.all(
      binaryNames.map(name => runBinaryCompatibilityProbe(name, installedPackageRoot)),
    )
    for (const projection of binaryProjections) {
      if (
        projection.version !== packageManifest.version ||
        projection.result.meta?.version !== packageManifest.version ||
        projection.result.meta?.schemaVersion !== '1' ||
        !Array.isArray(projection.result.data?.commands)
      ) {
        throw new Error(`Package binary ${projection.name} does not preserve the v1 version/discovery contract.`)
      }
    }
    if (JSON.stringify(binaryProjections[0]?.result.data) !== JSON.stringify(binaryProjections[1]?.result.data)) {
      throw new Error('qtx and quantex command discovery projections differ.')
    }

    await verifyRootDeclarationContract(installedPackageRoot)
    await verifyV1DownstreamCompatibility({ consumerRoot: installRoot, packageRoot: installedPackageRoot })

    console.log(
      `Managed-install tarball excludes dist/bin and postinstall entrypoints, keeps runtime/declaration files (${requiredFiles.join(', ')}), runs from an isolated local extraction with locked dependencies, preserves equivalent qtx/quantex entry points, and preserves the complete v1 downstream root contract.`,
    )
  } finally {
    await rm(tempRoot, { force: true, recursive: true })
  }
}

async function runBinaryCompatibilityProbe(
  name: string,
  packageRoot: string,
): Promise<{
  readonly name: string
  readonly result: StableCommandProjection
  readonly version: string
}> {
  const target = packageManifest.bin?.[name]
  if (!target) throw new Error(`Missing package binary target: ${name}`)
  const entry = join(packageRoot, target)
  const version = await runNodeEntry(entry, ['--version'])
  const discovery = await runNodeEntry(entry, ['commands', '--json'])
  return {
    name,
    result: JSON.parse(discovery) as StableCommandProjection,
    version: version.trim(),
  }
}

async function verifyRootDeclarationContract(packageRoot: string): Promise<void> {
  const expected = (await Bun.file(
    join(process.cwd(), 'test', 'fixtures', 'compatibility', 'v1', 'root-declaration.json'),
  ).json()) as RootDeclarationContract
  const declaration = await readFile(join(packageRoot, 'dist', 'index.d.mts'))
  const actual: RootDeclarationContract = {
    bytes: declaration.byteLength,
    sha256: createHash('sha256').update(declaration).digest('hex'),
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Packaged root declaration changed the maintained v1 signature contract.\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`,
    )
  }
}

async function runNodeEntry(entry: string, args: readonly string[]): Promise<string> {
  const child = Bun.spawn(['node', entry, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const [childStdout, childStderr, childExitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (childExitCode !== 0) {
    throw new Error(
      `Node package entry failed (${entry} ${args.join(' ')}) with exit ${childExitCode}.\n${childStderr.trim()}`,
    )
  }
  return childStdout
}

async function runChecked(command: readonly string[]): Promise<string> {
  const child = Bun.spawn([...command], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const [childStdout, childStderr, childExitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (childExitCode !== 0) {
    throw new Error(
      `Package verification command failed (${command.join(' ')}) with exit ${childExitCode}.\n${childStderr.trim() || childStdout.trim()}`,
    )
  }
  return childStdout
}

function parsePackOutput(packStdout: string): PackedPackage[] {
  const jsonStart = packStdout.lastIndexOf('\n[')
  const jsonText = (jsonStart >= 0 ? packStdout.slice(jsonStart + 1) : packStdout).trim()

  return JSON.parse(jsonText) as PackedPackage[]
}
