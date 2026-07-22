import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import process from 'node:process'

interface PackageExportConditions {
  readonly import?: string
  readonly types?: string
}

export interface CorePackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>
  readonly engines?: { readonly node?: string }
  readonly exports?: Readonly<Record<string, PackageExportConditions | string>>
  readonly name?: string
  readonly optionalDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
  readonly version?: string
}

export interface RootPackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly optionalDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
  readonly version?: string
  readonly workspaces?: readonly string[]
}

interface PackedFile {
  readonly path: string
}

interface PackedPackage {
  readonly files?: readonly PackedFile[]
  readonly filename?: string
}

const root = process.cwd()
const coreRoot = join(root, 'packages', 'core')

export function assertCorePackageManifestContract(
  rootManifest: RootPackageManifest,
  coreManifest: CorePackageManifest,
): void {
  const issues: string[] = []

  if (JSON.stringify(rootManifest.workspaces) !== JSON.stringify(['packages/core'])) {
    issues.push('the repository must declare packages/core as its only workspace')
  }
  if (coreManifest.name !== '@quantex/core') {
    issues.push(`the Core package name must be @quantex/core, found ${coreManifest.name ?? 'none'}`)
  }
  if (!rootManifest.version || rootManifest.version !== coreManifest.version) {
    issues.push(
      `root and Core versions must match exactly, found ${rootManifest.version ?? 'none'} and ${coreManifest.version ?? 'none'}`,
    )
  }
  if (rootManifest.devDependencies?.['@quantex/core'] !== coreManifest.version) {
    issues.push(
      `root devDependencies must pin @quantex/core exactly to ${coreManifest.version ?? 'the Core version'}, found ${rootManifest.devDependencies?.['@quantex/core'] ?? 'none'}`,
    )
  }
  if (coreManifest.engines?.node !== '>=20') {
    issues.push(`Core must declare Node.js >=20, found ${coreManifest.engines?.node ?? 'none'}`)
  }

  const coreRuntimeDependencyNames = [
    ...Object.keys(coreManifest.dependencies ?? {}),
    ...Object.keys(coreManifest.optionalDependencies ?? {}),
    ...Object.keys(coreManifest.peerDependencies ?? {}),
  ]
  if (coreRuntimeDependencyNames.length > 0) {
    issues.push(
      `the clean-consumer Core package must be self-contained, found ${coreRuntimeDependencyNames.join(', ')}`,
    )
  }

  const rootRuntimeCoreRanges = [
    rootManifest.dependencies?.['@quantex/core'],
    rootManifest.optionalDependencies?.['@quantex/core'],
    rootManifest.peerDependencies?.['@quantex/core'],
  ].filter((range): range is string => typeof range === 'string')
  if (rootRuntimeCoreRanges.length > 0) {
    issues.push(
      `the root CLI must inline Core instead of installing it at runtime, found ${rootRuntimeCoreRanges.join(', ')}`,
    )
  }

  const exportKeys = Object.keys(coreManifest.exports ?? {}).sort()
  if (JSON.stringify(exportKeys) !== JSON.stringify(['.', './package.json'])) {
    issues.push(`Core must expose only . and ./package.json, found ${exportKeys.join(', ') || 'none'}`)
  }
  const rootExport = coreManifest.exports?.['.']
  if (
    typeof rootExport === 'string' ||
    rootExport?.types !== './dist/index.d.mts' ||
    rootExport.import !== './dist/index.mjs'
  ) {
    issues.push('Core root export must map types to dist/index.d.mts and import to dist/index.mjs')
  }

  for (const [label, manifest] of [
    ['root', rootManifest],
    ['Core', coreManifest],
  ] as const) {
    if (JSON.stringify(manifest).includes('workspace:')) {
      issues.push(`${label} publishable manifest must not contain workspace: ranges`)
    }
  }

  if (issues.length > 0) {
    throw new Error(`Core package manifest contract failed:\n${issues.map(issue => `- ${issue}`).join('\n')}`)
  }
}

export async function verifyCorePackageDistribution(): Promise<void> {
  const rootManifest = (await Bun.file(join(root, 'package.json')).json()) as RootPackageManifest
  const coreManifest = (await Bun.file(join(coreRoot, 'package.json')).json()) as CorePackageManifest
  assertCorePackageManifestContract(rootManifest, coreManifest)

  const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-core-package-contract-'))
  try {
    const packOutput = await runChecked(['npm', 'pack', '--json', '--pack-destination', tempRoot], coreRoot)
    const packedPackage = parsePackOutput(packOutput)[0]
    if (!packedPackage?.filename) throw new Error('Core npm pack --json did not return a tarball filename.')

    const expectedFiles = ['LICENSE', 'README.md', 'dist/index.d.mts', 'dist/index.mjs', 'package.json']
    const packedFiles = (packedPackage.files ?? []).map(file => file.path).sort()
    if (JSON.stringify(packedFiles) !== JSON.stringify(expectedFiles)) {
      throw new Error(
        `Core tarball must contain only the public runtime, declarations, manifest, README, and license.\nExpected: ${expectedFiles.join(', ')}\nActual: ${packedFiles.join(', ')}`,
      )
    }

    const tarballPath = join(tempRoot, basename(packedPackage.filename))
    const unpackRoot = join(tempRoot, 'unpacked')
    const consumerRoot = join(tempRoot, 'consumer')
    await mkdir(unpackRoot, { recursive: true })
    await runChecked(['tar', '-xzf', tarballPath, '-C', unpackRoot], root)
    const installedPackageRoot = join(unpackRoot, 'package')

    const packedManifest = JSON.parse(
      await readFile(join(installedPackageRoot, 'package.json'), 'utf8'),
    ) as CorePackageManifest
    assertCorePackageManifestContract(rootManifest, packedManifest)
    assertMinimalCoreDeclaration(await readFile(join(installedPackageRoot, 'dist', 'index.d.mts'), 'utf8'))
    assertMinimalCoreRuntime(await readFile(join(installedPackageRoot, 'dist', 'index.mjs'), 'utf8'))

    await mkdir(consumerRoot, { recursive: true })
    await writeConsumerFixtures(consumerRoot)
    await runChecked(
      [
        'npm',
        'install',
        '--offline',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
        tarballPath,
      ],
      consumerRoot,
    )

    const nodeVersion = (await runChecked(['node', '--version'], consumerRoot)).trim()
    const nodeMajor = Number.parseInt(nodeVersion.replace(/^v/, '').split('.')[0] ?? '', 10)
    if (!Number.isFinite(nodeMajor) || nodeMajor < 20) {
      throw new Error(`Core package verification requires Node.js 20 or newer, found ${nodeVersion}.`)
    }

    await runChecked(['node', join(consumerRoot, 'runtime.mjs')], consumerRoot)
    await runChecked([process.execPath, join(consumerRoot, 'runtime.mjs')], consumerRoot)
    await runChecked(
      [
        'node',
        join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
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
      ],
      consumerRoot,
    )

    console.log(
      `Core tarball contains only ${expectedFiles.join(', ')}, installs offline into a dependency-free clean consumer, imports under ${nodeVersion} and Bun ${Bun.version}, and resolves with TypeScript NodeNext.`,
    )
  } finally {
    await rm(tempRoot, { force: true, recursive: true })
  }
}

function assertMinimalCoreDeclaration(declaration: string): void {
  const forbiddenFragments = [
    "from '../../src/",
    'from "../../src/',
    '@quantex/cli',
    'CliContext',
    'ManagedInstaller',
    'SelfUpgrade',
    'ReleaseArtifact',
  ]
  const leaked = forbiddenFragments.filter(fragment => declaration.includes(fragment))
  if (leaked.length > 0) {
    throw new Error(`Core declarations leak non-public implementation or CLI symbols: ${leaked.join(', ')}.`)
  }
}

function assertMinimalCoreRuntime(runtime: string): void {
  const maximumRuntimeBytes = 80_000
  const runtimeBytes = Buffer.byteLength(runtime)
  if (runtimeBytes > maximumRuntimeBytes) {
    throw new Error(`Core runtime exceeds the ${maximumRuntimeBytes}-byte lightweight budget: ${runtimeBytes} bytes.`)
  }
  const forbiddenFragments = [
    'idempotencyKey',
    'QUANTEX_RUN_ID',
    'runPackageMutationOutcome',
    'updateMany',
    'versions.json',
    'cli-context',
    'cli-operation-context',
    'commander',
    'picocolors',
    'prompts',
    'process.exit',
    'release-artifact',
    'self-upgrade',
  ]
  const leaked = forbiddenFragments.filter(fragment => runtime.includes(fragment))
  if (leaked.length > 0) {
    throw new Error(`Core runtime bundle contains CLI, presentation, self, or release code: ${leaked.join(', ')}.`)
  }
}

async function writeConsumerFixtures(consumerRoot: string): Promise<void> {
  await writeFile(join(consumerRoot, 'package.json'), `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`)
  await writeFile(
    join(consumerRoot, 'runtime.mjs'),
    [
      "import * as core from '@quantex/core'",
      '',
      'const exportNames = Object.keys(core).sort()',
      "if (JSON.stringify(exportNames) !== JSON.stringify(['createQuantex'])) {",
      "  throw new Error(`Unexpected Core runtime exports: ${exportNames.join(', ')}`)",
      '}',
      'const { createQuantex } = core',
      "if (typeof createQuantex !== 'function') throw new Error('createQuantex is not a function')",
      'const quantex = createQuantex()',
      "if (!quantex || typeof quantex.list !== 'function' || typeof quantex.inspect !== 'function') {",
      "  throw new Error('createQuantex did not return the public read client')",
      '}',
      '',
    ].join('\n'),
  )
  await writeFile(
    join(consumerRoot, 'consumer.ts'),
    [
      "import { createQuantex, type AgentDescriptor, type CoreResult } from '@quantex/core'",
      '// @ts-expect-error CLI implementation types are not part of the Core SDK.',
      "import type { ManagedInstaller } from '@quantex/core'",
      '// @ts-expect-error Core does not expose internal subpaths.',
      "import type {} from '@quantex/core/internal'",
      '',
      'const quantex = createQuantex()',
      'const agents: Promise<CoreResult<readonly AgentDescriptor[]>> = quantex.list()',
      'void agents',
      'void (undefined as unknown as ManagedInstaller)',
      '',
    ].join('\n'),
  )
}

async function runChecked(command: readonly string[], cwd: string): Promise<string> {
  const child = Bun.spawn([...command], {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(
      `Core package verification command failed (${command.join(' ')}) with exit ${exitCode}.\n${stderr.trim() || stdout.trim()}`,
    )
  }
  return stdout
}

function parsePackOutput(packStdout: string): PackedPackage[] {
  const jsonStart = packStdout.lastIndexOf('\n[')
  const jsonText = (jsonStart >= 0 ? packStdout.slice(jsonStart + 1) : packStdout).trim()
  return JSON.parse(jsonText) as PackedPackage[]
}

if (import.meta.main) await verifyCorePackageDistribution()
