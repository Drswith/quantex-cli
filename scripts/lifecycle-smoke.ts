import process from 'node:process'

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
const DEFAULT_SMOKE_SCENARIOS = ['managed', 'adopt-preinstalled', 'ambiguous-multi-method', 'self-binary']
const DEFAULT_COMMAND_TIMEOUT_MS = Number(process.env.QTX_ISOLATION_COMMAND_TIMEOUT_MS ?? 300_000)
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
  options: { allowExitCodes?: number[]; allowFailure?: boolean } = {},
): Promise<JsonResult> {
  const output = await runCommand(label, command)
  const allowedExitCodes = options.allowExitCodes ?? [0]
  if (!allowedExitCodes.includes(output.exitCode) && !options.allowFailure) throw commandError(label, command, output)

  const parsed = parseJsonResult(label, command, output)
  if (!options.allowFailure && parsed.ok !== true) {
    throw new Error(`${label} returned ok=false: ${parsed.error?.code ?? 'UNKNOWN'} ${parsed.error?.message ?? ''}`)
  }

  return parsed
}

async function runText(label: string, command: string[]): Promise<CommandOutput> {
  const output = await runCommand(label, command)
  if (output.exitCode !== 0) throw commandError(label, command, output)
  return output
}

async function runCommand(label: string, command: string[]): Promise<CommandOutput> {
  const proc = Bun.spawn(command, {
    env: {
      ...process.env,
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

function withPathPrefix(prefix: string, command: string[]): string[] {
  return ['env', `PATH=${prefix}:${process.env.PATH ?? ''}`, ...command]
}

function getCurrentLinuxBinaryTarget(): 'linux-arm64' | 'linux-x64' {
  if (process.arch === 'arm64') return 'linux-arm64'
  if (process.arch === 'x64') return 'linux-x64'

  throw new Error(`Unsupported Linux binary smoke architecture: ${process.arch}`)
}
