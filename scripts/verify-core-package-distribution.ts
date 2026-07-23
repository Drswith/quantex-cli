import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, posix } from 'node:path'
import process from 'node:process'
import ts from 'typescript'

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
const coreRuntimeEntry = 'dist/index.mjs'
const corePackageFiles = ['LICENSE', 'README.md', 'dist/index.d.mts', 'package.json'] as const
const maximumCoreEntryBytes = 80_000

const forbiddenRuntimeFragments = {
  'CLI or presentation': [
    'idempotencyKey',
    'QUANTEX_RUN_ID',
    'updateMany',
    'cli-context',
    'cli-operation-context',
    'commander',
    'picocolors',
    'prompts',
    'process.exit',
  ],
  'self-upgrade or release': ['versions.json', 'release-artifact', 'self-upgrade'],
  'unsupported Core infrastructure': ['@quantex/core/internal', 'catalog-source', 'update-cache', 'version-cache'],
} as const
const forbiddenEagerRuntimeFragments = ['runPackageMutationOutcome'] as const

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

export function assertCorePackageFileContract(
  packedFiles: readonly string[],
  runtimeModules: ReadonlyMap<string, string>,
): readonly string[] {
  for (const modulePath of runtimeModules.keys()) {
    if (!isCoreRuntimeModulePath(modulePath)) {
      throw new Error(`Core runtime module must be a top-level dist/*.mjs file, found ${modulePath}.`)
    }
  }

  const runtimeClosure = collectReachableCoreRuntime(runtimeModules)
  const eagerRuntime = new Set(runtimeClosure.eager)
  for (const [modulePath, runtime] of runtimeModules) {
    assertMinimalCoreRuntime(modulePath, runtime, eagerRuntime.has(modulePath))
  }

  const expectedFiles = [...corePackageFiles, ...runtimeClosure.complete].sort()
  const actualFiles = [...packedFiles].sort()
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(
      `Core tarball must contain only the public runtime import closure, declarations, manifest, README, and license.\nExpected: ${expectedFiles.join(', ')}\nActual: ${actualFiles.join(', ')}`,
    )
  }

  return Object.freeze(expectedFiles)
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

    const packedFiles = (packedPackage.files ?? []).map(file => file.path).sort()

    const tarballPath = join(tempRoot, basename(packedPackage.filename))
    const unpackRoot = join(tempRoot, 'unpacked')
    const consumerRoot = join(tempRoot, 'consumer')
    await mkdir(unpackRoot, { recursive: true })
    await runChecked(['tar', '-xzf', tarballPath, '-C', unpackRoot], root)
    const installedPackageRoot = join(unpackRoot, 'package')

    const packedManifest = JSON.parse(
      await readFile(join(installedPackageRoot, 'package.json'), 'utf8'),
    ) as CorePackageManifest
    const runtimeModules = new Map(
      await Promise.all(
        packedFiles
          .filter(isCoreRuntimeModulePath)
          .map(async path => [path, await readFile(join(installedPackageRoot, path), 'utf8')] as const),
      ),
    )
    const expectedFiles = assertCorePackageFileContract(packedFiles, runtimeModules)
    assertCorePackageManifestContract(rootManifest, packedManifest)
    assertMinimalCoreDeclaration(await readFile(join(installedPackageRoot, 'dist', 'index.d.mts'), 'utf8'))

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
      `Core tarball contains exactly ${expectedFiles.length} public and recursively reachable runtime files, keeps dist/index.mjs within ${maximumCoreEntryBytes} bytes, installs offline into a dependency-free clean consumer, imports under ${nodeVersion} and Bun ${Bun.version}, and resolves with TypeScript NodeNext.`,
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

function assertMinimalCoreRuntime(modulePath: string, runtime: string, eager: boolean): void {
  if (modulePath === coreRuntimeEntry) {
    const runtimeBytes = Buffer.byteLength(runtime)
    if (runtimeBytes > maximumCoreEntryBytes) {
      throw new Error(
        `Core runtime entry exceeds the ${maximumCoreEntryBytes}-byte lightweight budget: ${runtimeBytes} bytes.`,
      )
    }
  }

  const leaked = Object.entries(forbiddenRuntimeFragments).flatMap(([category, fragments]) =>
    fragments.filter(fragment => runtime.includes(fragment)).map(fragment => `${category}: ${fragment}`),
  )
  if (leaked.length > 0) {
    throw new Error(`Core runtime module ${modulePath} crosses a package boundary: ${leaked.join(', ')}.`)
  }

  const eagerLeak = eager ? forbiddenEagerRuntimeFragments.filter(fragment => runtime.includes(fragment)) : []
  if (eagerLeak.length > 0) {
    throw new Error(
      `Core eager read-only runtime module ${modulePath} contains mutation-only infrastructure: ${eagerLeak.join(', ')}.`,
    )
  }
}

function collectReachableCoreRuntime(runtimeModules: ReadonlyMap<string, string>): {
  readonly complete: readonly string[]
  readonly eager: readonly string[]
} {
  if (!runtimeModules.has(coreRuntimeEntry)) {
    throw new Error(`Core runtime entry ${coreRuntimeEntry} is missing from the packed artifact.`)
  }

  return {
    complete: walkRuntimeImports(runtimeModules, true),
    eager: walkRuntimeImports(runtimeModules, false),
  }
}

function walkRuntimeImports(
  runtimeModules: ReadonlyMap<string, string>,
  includeDynamicImports: boolean,
): readonly string[] {
  const reachable = new Set<string>()
  const queue = [coreRuntimeEntry]
  while (queue.length > 0) {
    const modulePath = queue.shift()
    if (!modulePath || reachable.has(modulePath)) continue
    const runtime = runtimeModules.get(modulePath)
    if (runtime === undefined) {
      throw new Error(`Core runtime import closure references missing module ${modulePath}.`)
    }
    reachable.add(modulePath)

    for (const runtimeImport of runtimeImportSpecifiers(modulePath, runtime)) {
      if (runtimeImport.dynamic && !includeDynamicImports) continue
      const { specifier } = runtimeImport
      if (specifier.startsWith('node:')) continue
      if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
        throw new Error(
          `Core runtime module ${modulePath} imports unsupported external runtime ${specifier}; the package must stay self-contained.`,
        )
      }
      if (specifier.includes('?') || specifier.includes('#')) {
        throw new Error(`Core runtime module ${modulePath} uses an unsupported local import ${specifier}.`)
      }

      const importedPath = posix.normalize(posix.join(posix.dirname(modulePath), specifier))
      if (!isCoreRuntimeModulePath(importedPath)) {
        throw new Error(
          `Core runtime module ${modulePath} imports ${specifier}, which resolves outside the supported dist/*.mjs runtime closure.`,
        )
      }
      if (!runtimeModules.has(importedPath)) {
        throw new Error(`Core runtime module ${modulePath} references missing module ${importedPath}.`)
      }
      if (!reachable.has(importedPath)) queue.push(importedPath)
    }
  }

  return Object.freeze([...reachable].sort())
}

function runtimeImportSpecifiers(
  modulePath: string,
  runtime: string,
): readonly { readonly dynamic: boolean; readonly specifier: string }[] {
  const sourceFile = ts.createSourceFile(modulePath, runtime, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const specifiers: { readonly dynamic: boolean; readonly specifier: string }[] = []

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push({ dynamic: false, specifier: node.moduleSpecifier.text })
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments
      if (!argument || !ts.isStringLiteralLike(argument)) {
        throw new Error(`Core runtime module ${modulePath} contains a non-literal dynamic import.`)
      }
      specifiers.push({ dynamic: true, specifier: argument.text })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return specifiers
}

function isCoreRuntimeModulePath(path: string): boolean {
  return /^dist\/[^/]+\.mjs$/u.test(path)
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
      "for (const method of ['list', 'inspect', 'install', 'ensure']) {",
      "  if (!quantex || typeof quantex[method] !== 'function') {",
      '    throw new Error(`createQuantex did not return public method ${method}`)',
      '  }',
      '}',
      '',
    ].join('\n'),
  )
  await writeFile(
    join(consumerRoot, 'consumer.ts'),
    [
      "import { createQuantex, type AgentDescriptor, type AgentMutation, type AgentMutationPhase, type AgentMutationSideEffect, type CoreResult } from '@quantex/core'",
      '// @ts-expect-error CLI implementation types are not part of the Core SDK.',
      "import type { ManagedInstaller } from '@quantex/core'",
      '// @ts-expect-error Core does not expose internal subpaths.',
      "import type {} from '@quantex/core/internal'",
      '',
      'const quantex = createQuantex()',
      'const agents: Promise<CoreResult<readonly AgentDescriptor[]>> = quantex.list()',
      "const preview: Promise<CoreResult<AgentMutation>> = quantex.install('codex', { mode: 'preview' })",
      "const apply: Promise<CoreResult<AgentMutation>> = quantex.ensure('codex', { mode: 'apply' })",
      'declare const mutation: AgentMutation',
      "if (mutation.mode === 'preview') {",
      '  const wouldChange: boolean = mutation.wouldChange',
      '  void wouldChange',
      '} else {',
      '  const changed: boolean = mutation.changed',
      '  void changed',
      '}',
      "const mutationResult = await quantex.install('codex', { mode: 'preview' })",
      "if (!mutationResult.ok && mutationResult.error.code === 'execution-failed') {",
      '  const phase: AgentMutationPhase = mutationResult.error.details.phase',
      '  const sideEffect: AgentMutationSideEffect = mutationResult.error.details.sideEffect',
      '  void phase',
      '  void sideEffect',
      '}',
      'void agents',
      'void preview',
      'void apply',
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
