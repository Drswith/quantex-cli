import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

interface AliasContract {
  readonly aliasPackage: string
  readonly binaryNames: readonly string[]
  readonly primaryPackage: string
}

interface PackageMetadata {
  readonly bin?: Readonly<Record<string, string>>
  readonly dependencies?: Readonly<Record<string, string>>
  readonly name?: string
  readonly version?: string
}

const root = process.cwd()
const fixture = (await Bun.file(
  join(root, 'test', 'fixtures', 'compatibility', 'v1', 'alias-package.json'),
).json()) as AliasContract
const primary = (await Bun.file(join(root, 'package.json')).json()) as PackageMetadata
const proc = Bun.spawn(['npm', 'view', fixture.aliasPackage, 'name', 'version', 'dependencies', 'bin', '--json'], {
  cwd: root,
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
    `External alias-package metadata probe was unavailable (exit ${exitCode}).\n${stderr.trim() || stdout.trim()}`,
  )
}

const alias = JSON.parse(stdout) as PackageMetadata
const actualBinaryNames = Object.keys(alias.bin ?? {}).sort()
const expectedBinaryNames = [...fixture.binaryNames].sort()
const dependencyVersion = alias.dependencies?.[fixture.primaryPackage]
const binaryTargets = new Set(Object.values(alias.bin ?? {}))

if (
  alias.name !== fixture.aliasPackage ||
  primary.name !== fixture.primaryPackage ||
  dependencyVersion !== primary.version ||
  JSON.stringify(actualBinaryNames) !== JSON.stringify(expectedBinaryNames) ||
  binaryTargets.size !== 1
) {
  throw new Error(
    [
      'External alias-package metadata does not satisfy the v1 compatibility contract.',
      `Alias: ${alias.name ?? 'missing'}@${alias.version ?? 'unknown'}`,
      `Primary dependency: ${fixture.primaryPackage}@${dependencyVersion ?? 'missing'}`,
      `Expected primary version: ${primary.version ?? 'missing'}`,
      `Binary names: ${actualBinaryNames.join(', ') || 'missing'}`,
      `Binary targets: ${[...binaryTargets].join(', ') || 'missing'}`,
    ].join('\n'),
  )
}

const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-alias-contract-'))
try {
  await runChecked([
    'npm',
    'install',
    '--prefix',
    tempRoot,
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
    `${fixture.aliasPackage}@${alias.version}`,
  ])
  const aliasRoot = join(tempRoot, 'node_modules', fixture.aliasPackage)
  const probes = await Promise.all(
    expectedBinaryNames.map(async name => {
      const target = alias.bin?.[name]
      if (!target) throw new Error(`External alias package is missing the ${name} target.`)
      const entry = join(aliasRoot, target)
      await access(entry)
      const version = (await runChecked(['node', entry, '--version'])).trim()
      const discovery = JSON.parse(await runChecked(['node', entry, 'commands', '--json'])) as {
        readonly data?: { readonly commands?: unknown[] }
        readonly meta?: { readonly schemaVersion?: string; readonly version?: string }
      }
      return { discovery, name, version }
    }),
  )

  for (const probe of probes) {
    if (
      probe.version !== primary.version ||
      probe.discovery.meta?.version !== primary.version ||
      probe.discovery.meta?.schemaVersion !== '1' ||
      !Array.isArray(probe.discovery.data?.commands)
    ) {
      throw new Error(`External alias entry ${probe.name} does not preserve the v1 runtime contract.`)
    }
  }
  if (JSON.stringify(probes[0]?.discovery.data) !== JSON.stringify(probes[1]?.discovery.data)) {
    throw new Error('External alias qtx/quantex discovery outputs differ.')
  }
} finally {
  await rm(tempRoot, { force: true, recursive: true })
}

console.log(
  `${fixture.aliasPackage}@${alias.version} depends on ${fixture.primaryPackage}@${dependencyVersion}; its installed ${expectedBinaryNames.join('/')} entries resolve to one target and preserve equivalent v1 runtime output.`,
)

async function runChecked(command: readonly string[]): Promise<string> {
  const child = Bun.spawn([...command], {
    cwd: root,
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
      `Alias-package command failed (${command.join(' ')}) with exit ${childExitCode}.\n${childStderr.trim() || childStdout.trim()}`,
    )
  }
  return childStdout
}
