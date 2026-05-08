import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { loadConfig } from '../src/config'
import { resolveManagedSelfUpdateRegistry } from '../src/self'
import {
  buildSelfManagedRegistryMetadata,
  parsePackedTarballName,
  resolveBunGlobalBinaryPath,
  SEEDED_SELF_VERSION,
} from '../src/testing/self-upgrade-sandbox'

interface CommandOutput {
  exitCode: number
  stderr: string
  stdout: string
}

interface JsonResult {
  action?: string
  data?: any
  error?: { code?: string; message?: string } | null
  ok?: boolean
  warnings?: Array<{ code?: string; message?: string }>
}

const DEFAULT_SMOKE_AGENTS = ['pi', 'qoder']
const DEFAULT_SMOKE_SCENARIOS = [
  'managed',
  'adopt-preinstalled',
  'ambiguous-multi-method',
  'self-binary',
  'self-managed',
]
const DEFAULT_COMMAND_TIMEOUT_MS = Number(process.env.QTX_ISOLATION_COMMAND_TIMEOUT_MS ?? 300_000)
const ROOT_PACKAGE_JSON_PATH = 'package.json'
const DIST_DIR = 'dist'
const agents = resolveSmokeAgents()
const scenarios = resolveSmokeScenarios()
const cli = ['bun', 'run', 'src/cli.ts', '--json', '--non-interactive', '--yes', '--color', 'never']

console.log(`Lifecycle smoke agents: ${agents.join(', ')}`)
console.log(`Lifecycle smoke scenarios: ${scenarios.join(', ')}`)

await runJson('config set defaultPackageManager bun', [...cli, 'config', 'set', 'defaultPackageManager', 'bun'])

const installedAgents: string[] = []

try {
  if (scenarios.includes('managed')) {
    for (const agent of agents) {
      installedAgents.push(agent)
      await smokeManagedAgentLifecycle(agent)
      installedAgents.pop()
    }
  }

  if (scenarios.includes('adopt-preinstalled')) {
    for (const agent of agents) await smokeAdoptPreinstalledAgent(agent)
  }

  if (scenarios.includes('ambiguous-multi-method')) await smokeAmbiguousMultiMethodAgent()

  if (scenarios.includes('self-binary')) await smokeSelfBinaryLifecycle()

  if (scenarios.includes('self-managed')) await smokeManagedSelfUpgradeLifecycle()
} finally {
  for (const agent of installedAgents.toReversed())
    await runJson(`cleanup uninstall ${agent}`, [...cli, 'uninstall', agent], {
      allowExitCodes: [0, 1],
      allowFailure: true,
    })
}

console.log('Lifecycle smoke completed successfully.')

async function smokeManagedAgentLifecycle(agent: string): Promise<void> {
  console.log(`\n[${agent}] inspect before install`)
  const beforeInstall = await runJson(`inspect ${agent} before install`, [...cli, 'inspect', agent])
  assertResult(
    beforeInstall,
    result => result.data?.inspection?.installed === false,
    `${agent} should start uninstalled`,
  )

  console.log(`[${agent}] install`)
  const install = await runJson(`install ${agent}`, [...cli, 'install', agent])
  assertResult(install, result => result.data?.installed === true, `${agent} install should report installed=true`)

  console.log(`[${agent}] inspect after install`)
  const afterInstall = await runJson(`inspect ${agent} after install`, [...cli, 'inspect', agent, '--refresh'])
  assertResult(afterInstall, result => result.data?.inspection?.installed === true, `${agent} should be installed`)
  assertResult(afterInstall, result => result.data?.inspection?.lifecycle === 'managed', `${agent} should be managed`)

  console.log(`[${agent}] resolve`)
  const resolve = await runJson(`resolve ${agent}`, [...cli, 'resolve', agent])
  assertResult(resolve, result => result.data?.resolution?.installed === true, `${agent} should resolve after install`)
  assertResult(resolve, result => Boolean(result.data?.resolution?.binaryPath), `${agent} should expose a binary path`)

  console.log(`[${agent}] ensure idempotency`)
  const ensure = await runJson(`ensure ${agent}`, [...cli, 'ensure', agent])
  assertResult(ensure, result => result.data?.installed === true, `${agent} ensure should report installed=true`)
  assertResult(ensure, result => result.data?.changed === false, `${agent} ensure should be idempotent`)

  console.log(`[${agent}] exec dry run`)
  await runText(`exec ${agent} dry run`, [...cli, '--dry-run', 'exec', agent, '--', '--version'])

  console.log(`[${agent}] update`)
  const update = await runJson(`update ${agent}`, [...cli, 'update', agent])
  assertResult(
    update,
    result => Array.isArray(result.data?.results) && result.data.results.length > 0,
    `${agent} update should return at least one result`,
  )

  console.log(`[${agent}] uninstall`)
  const uninstall = await runJson(`uninstall ${agent}`, [...cli, 'uninstall', agent])
  assertResult(uninstall, result => result.data?.changed === true, `${agent} uninstall should report changed=true`)

  console.log(`[${agent}] inspect after uninstall`)
  const afterUninstall = await runJson(`inspect ${agent} after uninstall`, [...cli, 'inspect', agent, '--refresh'])
  assertResult(
    afterUninstall,
    result => result.data?.inspection?.installed === false,
    `${agent} should be uninstalled after lifecycle smoke`,
  )
}

async function smokeAdoptPreinstalledAgent(agent: string): Promise<void> {
  console.log(`\n[${agent}] preinstall outside Quantex`)
  await runText(`preinstall ${agent}`, ['bun', 'add', '-g', getAgentPackageName(agent)])

  console.log(`[${agent}] install should adopt existing agent`)
  const install = await runJson(`install ${agent} adopts existing`, [...cli, 'install', agent])
  assertResult(install, result => result.data?.installed === true, `${agent} adoption should report installed=true`)
  assertResult(install, result => result.data?.changed === true, `${agent} adoption should persist tracked state`)
  assertResult(
    install,
    result => result.warnings?.some(warning => warning.code === 'TRACKED_EXISTING_INSTALL') === true,
    `${agent} adoption should warn that Quantex tracked an existing install`,
  )

  console.log(`[${agent}] inspect adopted state`)
  const inspection = await runJson(`inspect adopted ${agent}`, [...cli, 'inspect', agent, '--refresh'])
  assertResult(inspection, result => result.data?.inspection?.installed === true, `${agent} should remain installed`)
  assertResult(inspection, result => result.data?.inspection?.lifecycle === 'managed', `${agent} should be managed`)

  console.log(`[${agent}] uninstall adopted agent`)
  const uninstall = await runJson(`uninstall adopted ${agent}`, [...cli, 'uninstall', agent])
  assertResult(uninstall, result => result.data?.changed === true, `${agent} adopted uninstall should change state`)
}

async function smokeSelfBinaryLifecycle(): Promise<void> {
  const binaryTarget = getCurrentLinuxBinaryTarget()
  const binaryAsset = `dist/bin/quantex-${binaryTarget}`

  console.log('\n[self] build Linux standalone binary')
  await runText('build linux self binary', ['bun', 'run', 'build:bin', binaryTarget])

  console.log('[self] install standalone binary into isolated HOME')
  await runText('install local self binary', [
    'sh',
    '-c',
    [
      'set -euo pipefail',
      'mkdir -p "$HOME/.local/bin" "$HOME/.quantex"',
      `cp ${binaryAsset} "$HOME/.local/bin/quantex"`,
      'chmod +x "$HOME/.local/bin/quantex"',
      'ln -sf "$HOME/.local/bin/quantex" "$HOME/.local/bin/qtx"',
      'printf \'{"installedAgents":{},"self":{"installSource":"binary"}}\\n\' > "$HOME/.quantex/state.json"',
    ].join(' && '),
  ])

  const binaryCli = '$HOME/.local/bin/qtx --json --non-interactive --yes --color never'

  console.log('[self] binary commands catalog')
  const commands = await runJson('binary qtx commands', shellCommand(`${binaryCli} commands`))
  assertResult(commands, result => result.action === 'commands', 'binary qtx should emit the commands action')

  console.log('[self] binary inspect pi')
  const inspection = await runJson('binary qtx inspect pi', shellCommand(`${binaryCli} inspect pi`))
  assertResult(inspection, result => result.data?.agent?.name === 'pi', 'binary qtx should inspect agent catalog')

  console.log('[self] binary upgrade check')
  const upgrade = await runJson('binary qtx upgrade --check', shellCommand(`${binaryCli} upgrade --check`), {
    allowExitCodes: [0, 1, 6],
    allowFailure: true,
  })
  assertResult(upgrade, result => result.action === 'upgrade', 'binary qtx should emit the upgrade action')
  assertResult(upgrade, result => result.data?.installSource === 'binary', 'binary qtx should inspect itself as binary')
  assertResult(upgrade, result => result.data?.canAutoUpdate === true, 'binary qtx should support self auto-update')
}

async function smokeManagedSelfUpgradeLifecycle(): Promise<void> {
  console.log('\n[self] build managed self-upgrade package')
  await runText('build managed self package', ['bun', 'run', 'build'])

  const currentPackage = await readRootPackageManifest()
  const sandboxRoot = await mkdtemp(join(tmpdir(), 'quantex-self-managed-'))

  try {
    const registry = await createSelfManagedRegistry(sandboxRoot, currentPackage)

    try {
      const sandboxHome = join(sandboxRoot, 'home')
      const bunInstallDir = join(sandboxHome, '.bun')
      const managedBinDir = join(bunInstallDir, 'bin')
      let managedQtx = join(managedBinDir, 'qtx')
      const managedEnv = {
        HOME: sandboxHome,
        BUN_INSTALL: bunInstallDir,
        PATH: `${managedBinDir}:${process.env.PATH ?? ''}`,
        QTX_SELF_UPDATE_REGISTRY: registry.registryUrl,
      }

      console.log('[self] install seeded Bun-managed Quantex from local registry')
      await runText(
        'install seeded Bun-managed Quantex',
        ['bun', 'add', '-g', `${currentPackage.name}@${SEEDED_SELF_VERSION}`, '--registry', registry.registryUrl],
        { env: managedEnv },
      )
      const pmBin = await runText('resolve Bun global bin dir', ['bun', 'pm', 'bin', '-g'], {
        env: managedEnv,
      })
      managedQtx = resolveBunGlobalBinaryPath({
        binaryName: 'qtx',
        fallbackBinDir: managedBinDir,
        pmBinOutput: pmBin.stdout,
      })
      await assertFileExists(
        managedQtx,
        `Bun-managed qtx shim was not created at ${managedQtx} after installing seeded Quantex.`,
        sandboxRoot,
      )

      const seededVersion = await runText('seeded Bun-managed qtx version', [managedQtx, '--version'], {
        env: managedEnv,
      })
      if (seededVersion.stdout.trim() !== SEEDED_SELF_VERSION) {
        throw new Error(
          `Seeded Bun-managed qtx should report ${SEEDED_SELF_VERSION}, received ${seededVersion.stdout.trim() || '(empty)'}.`,
        )
      }

      console.log('[self] managed upgrade check')
      const upgradeCheck = await runJson(
        'managed self upgrade check',
        [...buildSelfJsonCommand(managedQtx), 'upgrade', '--check'],
        {
          allowExitCodes: [1],
          env: managedEnv,
        },
      )
      assertResult(
        upgradeCheck,
        result => result.action === 'upgrade',
        'managed self upgrade check should emit upgrade action',
      )
      assertResult(
        upgradeCheck,
        result => result.data?.status === 'update-available',
        'managed self upgrade check should report update-available',
      )
      assertResult(
        upgradeCheck,
        result => result.data?.currentVersion === SEEDED_SELF_VERSION,
        'managed self upgrade check should report the seeded current version',
      )
      assertResult(
        upgradeCheck,
        result => result.data?.latestVersion === currentPackage.version,
        'managed self upgrade check should resolve the current checkout version as latest',
      )
      assertResult(
        upgradeCheck,
        result => result.data?.installSource === 'bun',
        'managed self upgrade check should inspect the install source as bun',
      )

      console.log('[self] managed self-upgrade execution')
      const upgrade = await runJson('managed self upgrade', [...buildSelfJsonCommand(managedQtx), 'upgrade'], {
        env: managedEnv,
      })
      assertResult(upgrade, result => result.action === 'upgrade', 'managed self upgrade should emit upgrade action')
      assertResult(upgrade, result => result.data?.status === 'updated', 'managed self upgrade should report updated')
      assertResult(
        upgrade,
        result => result.data?.installSource === 'bun',
        'managed self upgrade should keep the bun install source',
      )

      const upgradedVersion = await runText('upgraded Bun-managed qtx version', [managedQtx, '--version'], {
        env: managedEnv,
      })
      if (upgradedVersion.stdout.trim() !== currentPackage.version) {
        throw new Error(
          `Upgraded Bun-managed qtx should report ${currentPackage.version}, received ${upgradedVersion.stdout.trim() || '(empty)'}.`,
        )
      }

      console.log('[self] managed upgrade check after upgrade')
      const postUpgradeCheck = await runJson(
        'managed self upgrade check after upgrade',
        [...buildSelfJsonCommand(managedQtx), 'upgrade', '--check'],
        {
          allowExitCodes: [0],
          env: managedEnv,
        },
      )
      assertResult(
        postUpgradeCheck,
        result => result.data?.status === 'up-to-date',
        'managed self upgrade check should report up-to-date after upgrade',
      )
      assertResult(
        postUpgradeCheck,
        result => result.data?.currentVersion === currentPackage.version,
        'managed self upgrade check should report the upgraded current version',
      )
    } finally {
      registry.close()
    }
  } finally {
    await rm(sandboxRoot, { force: true, recursive: true })
  }
}

async function smokeAmbiguousMultiMethodAgent(): Promise<void> {
  const agent = 'qoder'
  const binaryName = 'qodercli'
  const fakeBinDir = '/tmp/quantex-ambiguous-bin'

  console.log(`\n[${agent}] ambiguous multi-method PATH install should remain untracked`)
  await runText(`create ambiguous ${agent} binary`, [
    'sh',
    '-c',
    [
      'set -euo pipefail',
      `mkdir -p ${fakeBinDir}`,
      `printf '#!/usr/bin/env sh\\necho qodercli 1.2.3\\n' > ${fakeBinDir}/${binaryName}`,
      `chmod +x ${fakeBinDir}/${binaryName}`,
    ].join(' && '),
  ])

  const ambiguousCli = withPathPrefix(fakeBinDir, [...cli, 'install', agent])
  const install = await runJson(`install ambiguous ${agent}`, ambiguousCli)
  assertResult(install, result => result.data?.installed === true, `${agent} should be visible in PATH`)
  assertResult(install, result => result.data?.changed === false, `${agent} ambiguous install should not change state`)
  assertResult(
    install,
    result => result.warnings?.some(warning => warning.code === 'UNTRACKED_EXISTING_INSTALL') === true,
    `${agent} ambiguous install should remain untracked`,
  )

  const inspection = await runJson(`inspect ambiguous ${agent}`, withPathPrefix(fakeBinDir, [...cli, 'inspect', agent]))
  assertResult(
    inspection,
    result => result.data?.inspection?.lifecycle === 'unmanaged',
    `${agent} ambiguous install should inspect as unmanaged`,
  )
}

async function runJson(
  label: string,
  command: string[],
  options: {
    allowExitCodes?: number[]
    allowFailure?: boolean
    cwd?: string
    env?: Record<string, string | undefined>
  } = {},
): Promise<JsonResult> {
  const output = await runCommand(label, command, options)
  const allowedExitCodes = options.allowExitCodes ?? [0]
  if (!allowedExitCodes.includes(output.exitCode) && !options.allowFailure) throw commandError(label, command, output)

  const parsed = parseJsonResult(label, command, output)
  if (!options.allowFailure && parsed.ok !== true) {
    throw new Error(`${label} returned ok=false: ${parsed.error?.code ?? 'UNKNOWN'} ${parsed.error?.message ?? ''}`)
  }

  return parsed
}

async function runText(
  label: string,
  command: string[],
  options: { cwd?: string; env?: Record<string, string | undefined> } = {},
): Promise<CommandOutput> {
  const output = await runCommand(label, command, options)
  if (output.exitCode !== 0) throw commandError(label, command, output)
  return output
}

async function runCommand(
  label: string,
  command: string[],
  options: { cwd?: string; env?: Record<string, string | undefined> } = {},
): Promise<CommandOutput> {
  const proc = Bun.spawn(command, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'] as const,
  })

  const timeout = setTimeout(() => {
    proc.kill('SIGTERM')
  }, DEFAULT_COMMAND_TIMEOUT_MS)

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  clearTimeout(timeout)

  if (stderr.trim()) process.stderr.write(`[${label} stderr]\n${stderr}`)

  return {
    exitCode,
    stderr,
    stdout,
  }
}

function parseJsonResult(label: string, command: string[], output: CommandOutput): JsonResult {
  try {
    return JSON.parse(output.stdout) as JsonResult
  } catch (error) {
    throw new Error(
      [
        `Failed to parse JSON output for ${label}.`,
        `Command: ${command.join(' ')}`,
        `Exit code: ${output.exitCode}`,
        `Stdout: ${output.stdout.trim() || '(empty)'}`,
        `Stderr: ${output.stderr.trim() || '(empty)'}`,
        `Parse error: ${error instanceof Error ? error.message : String(error)}`,
      ].join('\n'),
      { cause: error },
    )
  }
}

function assertResult(result: JsonResult, predicate: (result: JsonResult) => boolean, message: string): void {
  if (!predicate(result)) throw new Error(message)
}

function commandError(label: string, command: string[], output: CommandOutput): Error {
  return new Error(
    [
      `${label} failed.`,
      `Command: ${command.join(' ')}`,
      `Exit code: ${output.exitCode}`,
      `Stdout: ${output.stdout.trim() || '(empty)'}`,
      `Stderr: ${output.stderr.trim() || '(empty)'}`,
    ].join('\n'),
  )
}

function resolveSmokeAgents(): string[] {
  const cliAgents = process.argv.slice(2).filter(Boolean)
  if (cliAgents.length > 0) return cliAgents

  const envAgents = process.env.QTX_ISOLATION_AGENTS?.split(',')
    .map(agent => agent.trim())
    .filter(Boolean)
  if (envAgents && envAgents.length > 0) return envAgents

  return DEFAULT_SMOKE_AGENTS
}

function resolveSmokeScenarios(): string[] {
  const envScenarios = process.env.QTX_ISOLATION_SCENARIOS?.split(',')
    .map(scenario => scenario.trim())
    .filter(Boolean)

  if (envScenarios && envScenarios.length > 0) return envScenarios

  return DEFAULT_SMOKE_SCENARIOS
}

function getAgentPackageName(agent: string): string {
  if (agent === 'pi') return '@mariozechner/pi-coding-agent'
  if (agent === 'qoder') return '@qoder-ai/qodercli'
  if (agent === 'opencode') return 'opencode-ai'

  throw new Error(
    `Lifecycle smoke does not know how to preinstall "${agent}". Add its package mapping before including it in adopt-preinstalled.`,
  )
}

function shellCommand(command: string): string[] {
  return ['sh', '-c', command]
}

function buildSelfJsonCommand(binaryPath: string): string[] {
  return [binaryPath, '--json', '--non-interactive', '--yes', '--color', 'never', '--no-cache']
}

function withPathPrefix(prefix: string, command: string[]): string[] {
  return ['env', `PATH=${prefix}:${process.env.PATH ?? ''}`, ...command]
}

function getCurrentLinuxBinaryTarget(): 'linux-arm64' | 'linux-x64' {
  if (process.arch === 'arm64') return 'linux-arm64'
  if (process.arch === 'x64') return 'linux-x64'

  throw new Error(`Unsupported Linux binary smoke architecture: ${process.arch}`)
}

async function readRootPackageManifest(): Promise<{ name: string; version: string }> {
  const packageJson = JSON.parse(await readFile(ROOT_PACKAGE_JSON_PATH, 'utf8')) as {
    name?: string
    version?: string
  }

  if (!packageJson.name || !packageJson.version) {
    throw new Error('The root package.json must define name and version for the self-managed smoke scenario.')
  }

  return {
    name: packageJson.name,
    version: packageJson.version,
  }
}

async function createSelfManagedRegistry(
  sandboxRoot: string,
  currentPackage: { name: string; version: string },
): Promise<{ close: () => void; registryUrl: string }> {
  const registryDir = join(sandboxRoot, 'registry')
  const latestStageDir = join(sandboxRoot, 'latest-package')
  const seededStageDir = join(sandboxRoot, 'seeded-package')

  await mkdir(registryDir, { recursive: true })
  const latestManifest = await stageSelfManagedPackage(latestStageDir, currentPackage.version)
  const seededManifest = await stageSelfManagedPackage(seededStageDir, SEEDED_SELF_VERSION)

  const latestTarball = await packSelfManagedPackage('pack latest self-managed package', latestStageDir, registryDir)
  const seededTarball = await packSelfManagedPackage('pack seeded self-managed package', seededStageDir, registryDir)
  const latestRegistryEntry = buildSelfManagedRegistryMetadata({
    latestPackageManifest: latestManifest,
    latestTarballName: latestTarball,
    origin: 'http://placeholder.invalid',
    seededPackageManifest: seededManifest,
    seededTarballName: seededTarball,
  }).versions[currentPackage.version]
  const seededRegistryEntry = buildSelfManagedRegistryMetadata({
    latestPackageManifest: latestManifest,
    latestTarballName: latestTarball,
    origin: 'http://placeholder.invalid',
    seededPackageManifest: seededManifest,
    seededTarballName: seededTarball,
  }).versions[SEEDED_SELF_VERSION]

  const encodedPackagePath = `/${encodeURIComponent(currentPackage.name)}`
  const encodedLatestPath = `${encodedPackagePath}/latest`
  const encodedSeededPath = `${encodedPackagePath}/${encodeURIComponent(SEEDED_SELF_VERSION)}`
  const encodedCurrentPath = `${encodedPackagePath}/${encodeURIComponent(currentPackage.version)}`
  const dependencyRegistryOrigin = await resolveSelfManagedDependencyRegistry()

  let server: ReturnType<typeof Bun.serve>
  server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      const url = new URL(request.url)
      const origin = url.origin

      if (url.pathname === encodedPackagePath || url.pathname === `/${currentPackage.name}`) {
        return Response.json(
          buildSelfManagedRegistryMetadata({
            latestPackageManifest: latestManifest,
            latestTarballName: latestTarball,
            origin,
            seededPackageManifest: seededManifest,
            seededTarballName: seededTarball,
          }),
        )
      }

      if (url.pathname === encodedLatestPath) {
        return Response.json({
          ...latestRegistryEntry,
          dist: {
            tarball: `${origin}/${latestTarball}`,
          },
        })
      }
      if (url.pathname === encodedSeededPath) {
        return Response.json({
          ...seededRegistryEntry,
          dist: {
            tarball: `${origin}/${seededTarball}`,
          },
        })
      }
      if (url.pathname === encodedCurrentPath) {
        return Response.json({
          ...latestRegistryEntry,
          dist: {
            tarball: `${origin}/${latestTarball}`,
          },
        })
      }

      if (url.pathname === `/${seededTarball}`) {
        return new Response(Bun.file(join(registryDir, seededTarball)), {
          headers: {
            'content-type': 'application/octet-stream',
          },
        })
      }

      if (url.pathname === `/${latestTarball}`) {
        return new Response(Bun.file(join(registryDir, latestTarball)), {
          headers: {
            'content-type': 'application/octet-stream',
          },
        })
      }

      return Response.redirect(`${dependencyRegistryOrigin}${url.pathname}${url.search}`, 302)
    },
  })

  return {
    close: () => server.stop(true),
    registryUrl: `http://127.0.0.1:${server.port}`,
  }
}

async function stageSelfManagedPackage(
  stageDir: string,
  targetVersion: string,
): Promise<Record<string, unknown> & { name: string; version: string }> {
  await mkdir(stageDir, { recursive: true })
  await cp(DIST_DIR, join(stageDir, DIST_DIR), { recursive: true })
  await cp(ROOT_PACKAGE_JSON_PATH, join(stageDir, ROOT_PACKAGE_JSON_PATH))

  const packageJsonPath = join(stageDir, ROOT_PACKAGE_JSON_PATH)
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as Record<string, unknown>
  const currentVersion = typeof packageJson.version === 'string' ? packageJson.version : undefined
  const packageName = typeof packageJson.name === 'string' ? packageJson.name : undefined

  if (!currentVersion || !packageName) {
    throw new Error('The root package.json must define name and version for the self-managed smoke scenario.')
  }

  packageJson.version = targetVersion
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')

  if (targetVersion === currentVersion) {
    return packageJson as Record<string, unknown> & { name: string; version: string }
  }

  const distFiles = await readdir(join(stageDir, DIST_DIR))
  for (const fileName of distFiles) {
    if (!fileName.endsWith('.mjs') && !fileName.endsWith('.mts')) continue

    const filePath = join(stageDir, DIST_DIR, fileName)
    const content = await readFile(filePath, 'utf8')
    await writeFile(filePath, content.replaceAll(currentVersion, targetVersion), 'utf8')
  }

  return packageJson as Record<string, unknown> & { name: string; version: string }
}

async function packSelfManagedPackage(label: string, packageDir: string, registryDir: string): Promise<string> {
  const output = await runText(
    label,
    ['bun', 'pm', 'pack', '--quiet', '--ignore-scripts', '--destination', registryDir],
    { cwd: packageDir },
  )
  const tarballName = parsePackedTarballName(output.stdout)

  if (!tarballName) throw new Error(`${label} did not report a tarball filename.`)

  return tarballName
}

async function assertFileExists(path: string, message: string, debugRoot: string): Promise<void> {
  try {
    await access(path)
  } catch (error) {
    await dumpDirectoryTree(debugRoot)
    throw new Error(message, { cause: error })
  }
}

async function dumpDirectoryTree(root: string): Promise<void> {
  const output = await runCommand('debug self-managed sandbox tree', ['find', root, '-maxdepth', '5', '-print'])
  process.stderr.write(`[self-managed sandbox tree]\n${output.stdout}`)
}

async function resolveSelfManagedDependencyRegistry(): Promise<string> {
  const envOverride = process.env.QTX_SELF_MANAGED_DEPENDENCY_REGISTRY?.trim()
  if (envOverride) return envOverride.replace(/\/+$/, '')

  const config = await loadConfig()
  const resolution = await resolveManagedSelfUpdateRegistry(
    'bun',
    config,
    {
      ...process.env,
      QTX_SELF_UPDATE_REGISTRY: '',
    },
    process.cwd(),
  )

  return resolution?.registry ?? 'https://registry.npmjs.org'
}
