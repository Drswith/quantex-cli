import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

interface PackedFile {
  path: string
}

interface PackedPackage {
  files?: PackedFile[]
  filename?: string
}

interface PackageManifest {
  bin?: Record<string, string>
  dependencies?: Record<string, string>
  name?: string
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  version?: string
}

interface RootDeclarationContract {
  readonly bytes: number
  readonly sha256: string
}

interface DownstreamRuntimeResult {
  readonly agent: string
  readonly exitCode: number
  readonly ok: boolean
  readonly version: string
}

interface DownstreamCompatibilityOptions {
  readonly consumerRoot?: string
  readonly packageRoot?: string
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
    const providedTarballPath = process.argv[2]
    const packOutput = providedTarballPath
      ? undefined
      : await runChecked(['npm', 'pack', '--ignore-scripts', '--json', '--pack-destination', tempRoot])
    const packedPackage = providedTarballPath
      ? await inspectExistingTarball(providedTarballPath)
      : parsePackOutput(packOutput ?? '')[0]
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

    const tarballPath = providedTarballPath ?? join(tempRoot, basename(packedPackage.filename))
    const unpackRoot = join(tempRoot, 'unpacked')
    const installRoot = join(tempRoot, 'consumer')
    await mkdir(unpackRoot, { recursive: true })
    await runChecked(['tar', '-xzf', tarballPath, '-C', unpackRoot])
    const installedPackageRoot = join(unpackRoot, 'package')
    assertCoreIsNotARuntimeDependency(packageManifest)
    await copyInstalledRuntimeDependencies(installedPackageRoot, packageManifest.dependencies ?? {})
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
      `Managed-install tarball excludes dist/bin and postinstall entrypoints, keeps runtime/declaration files (${requiredFiles.join(', ')}), runs from an isolated local extraction with copied production dependencies and no installed quantex-core package, preserves equivalent qtx/quantex entry points, and preserves the complete v1 downstream root contract.`,
    )
  } finally {
    await rm(tempRoot, { force: true, recursive: true })
  }
}

async function inspectExistingTarball(tarballPath: string): Promise<PackedPackage> {
  const listing = await runChecked(['tar', '-tzf', tarballPath])
  const files = listing
    .split(/\r?\n/)
    .filter(path => path.startsWith('package/') && !path.endsWith('/'))
    .map(path => ({ path: path.slice('package/'.length) }))

  if (files.length === 0) throw new Error(`Candidate tarball has no package files: ${tarballPath}`)
  return { filename: basename(tarballPath), files }
}

function assertCoreIsNotARuntimeDependency(manifest: PackageManifest): void {
  const runtimeRanges = [
    manifest.dependencies?.['quantex-core'],
    manifest.optionalDependencies?.['quantex-core'],
    manifest.peerDependencies?.['quantex-core'],
  ].filter((range): range is string => typeof range === 'string')

  if (runtimeRanges.length > 0) {
    throw new Error(
      `Managed-install package must inline quantex-core instead of requiring it at runtime; found ${runtimeRanges.join(', ')}.`,
    )
  }
}

async function copyInstalledRuntimeDependencies(
  packageRoot: string,
  dependencies: Readonly<Record<string, string>>,
): Promise<void> {
  const targetNodeModules = join(packageRoot, 'node_modules')
  const pending = await Promise.all(
    Object.keys(dependencies).map(async name => ({
      destinationNodeModules: targetNodeModules,
      name,
      source: await resolveInstalledPackage(process.cwd(), name),
    })),
  )
  const copied = new Set<string>()
  const copiedNames = new Set<string>()

  while (pending.length > 0) {
    const dependency = pending.shift()
    if (!dependency) continue

    const destination = join(dependency.destinationNodeModules, dependency.name)
    const copyKey = `${dependency.source}\0${destination}`
    if (copied.has(copyKey)) continue
    copied.add(copyKey)
    copiedNames.add(dependency.name)

    await mkdir(dirname(destination), { recursive: true })
    await cp(dependency.source, destination, { dereference: true, recursive: true })

    const dependencyManifest = JSON.parse(
      await readFile(join(dependency.source, 'package.json'), 'utf8'),
    ) as PackageManifest
    const childNodeModules = join(destination, 'node_modules')
    for (const childName of Object.keys(dependencyManifest.dependencies ?? {})) {
      pending.push({
        destinationNodeModules: childNodeModules,
        name: childName,
        source: await resolveInstalledPackage(dependency.source, childName),
      })
    }
  }

  if (copiedNames.has('quantex-core')) {
    throw new Error('Isolated managed-install dependency tree unexpectedly contains quantex-core.')
  }
}

async function resolveInstalledPackage(parentPackageRoot: string, name: string): Promise<string> {
  const requireFromParent = createRequire(join(parentPackageRoot, 'package.json'))
  try {
    return dirname(await realpath(requireFromParent.resolve(`${name}/package.json`)))
  } catch (error) {
    if (!isPackageManifestResolutionError(error)) throw error
  }

  let candidate = dirname(await realpath(requireFromParent.resolve(name)))
  while (candidate !== dirname(candidate)) {
    try {
      const manifest = JSON.parse(await readFile(join(candidate, 'package.json'), 'utf8')) as PackageManifest
      if (manifest.name === name) return candidate
    } catch (error) {
      if (!isMissingFileError(error)) throw error
    }
    candidate = dirname(candidate)
  }

  throw new Error(`Unable to resolve installed package root for ${name} from ${parentPackageRoot}.`)
}

function isPackageManifestResolutionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' || error.code === 'MODULE_NOT_FOUND')
  )
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
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

async function verifyV1DownstreamCompatibility(options: DownstreamCompatibilityOptions = {}): Promise<void> {
  const root = process.cwd()
  const fixtureRoot = join(root, 'test', 'fixtures', 'compatibility', 'v1', 'downstream')
  const consumerRoot = options.consumerRoot ?? fixtureRoot
  const packageRoot = options.packageRoot ?? root
  const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')

  if (consumerRoot !== fixtureRoot) {
    await mkdir(consumerRoot, { recursive: true })
    await Promise.all(['consumer.ts', 'runtime.mjs'].map(file => cp(join(fixtureRoot, file), join(consumerRoot, file))))
  }

  const semanticRuntimeExportConsumer = join(consumerRoot, `all-runtime-exports.${process.pid}.ts`)
  await writeFile(semanticRuntimeExportConsumer, await createSemanticRuntimeExportConsumer(root))

  try {
    await runCheckedIn(
      [
        process.execPath,
        tsc,
        '--noEmit',
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        '--target',
        'ES2022',
        '--strict',
        '--skipLibCheck',
        join(consumerRoot, 'consumer.ts'),
        semanticRuntimeExportConsumer,
      ],
      consumerRoot,
    )
  } finally {
    await rm(semanticRuntimeExportConsumer, { force: true })
  }

  const runtime = await runCheckedIn(['node', join(consumerRoot, 'runtime.mjs')], consumerRoot)
  const actual = JSON.parse(runtime.stdout) as DownstreamRuntimeResult
  const downstreamManifest = (await Bun.file(join(packageRoot, 'package.json')).json()) as PackageManifest
  const downstreamVersion = downstreamManifest.version
  if (!downstreamVersion) throw new Error('Installed package manifest is missing a version.')

  const expected: DownstreamRuntimeResult = {
    agent: 'codex',
    exitCode: 0,
    ok: true,
    version: downstreamVersion,
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Built root runtime changed the v1 downstream contract.\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`,
    )
  }
}

async function createSemanticRuntimeExportConsumer(root: string): Promise<string> {
  const fixturePath = join(root, 'test', 'fixtures', 'compatibility', 'v1', 'root-exports.json')
  const exportNames = JSON.parse(await readFile(fixturePath, 'utf8')) as unknown
  if (
    !Array.isArray(exportNames) ||
    exportNames.some(name => typeof name !== 'string' || !/^[$A-Z_a-z][$\w]*$/u.test(name))
  ) {
    throw new Error('The maintained v1 root export fixture must contain TypeScript identifiers.')
  }

  return [
    "import * as quantex from 'quantex-cli'",
    '',
    'const maintainedRuntimeExports = {',
    ...exportNames.map(name => `  ${name}: quantex.${name},`),
    '} as const',
    '',
    'void maintainedRuntimeExports',
    '',
  ].join('\n')
}

async function runCheckedIn(command: readonly string[], cwd: string): Promise<{ readonly stdout: string }> {
  const proc = Bun.spawn([...command], {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(
      `Downstream compatibility command failed (${command.join(' ')}) with exit code ${exitCode}.\n${stderr.trim() || stdout.trim()}`,
    )
  }
  return { stdout }
}
