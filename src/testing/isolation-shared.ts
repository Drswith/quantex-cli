import { basename } from 'node:path'
import process from 'node:process'

export const DEFAULT_ISOLATION_IMAGE =
  process.env.QTX_ISOLATION_IMAGE ||
  process.env.QTX_MODAL_IMAGE ||
  process.env.MODAL_SANDBOX_IMAGE ||
  'docker.io/oven/bun:1.3.14'

export const DEFAULT_ISOLATION_SMOKE_ARGS: string[] = []

const FORWARDED_ISOLATION_ENV = [
  'CONFIGURE',
  'DISABLE_AUTOUPDATER',
  'DISABLE_UPDATES',
  'QTX_CANARY_COVERAGE',
  'QTX_CANARY_PROVIDER',
  'QTX_CANARY_REQUIRE_VERSION',
  'QTX_CANARY_SETUP',
  'QTX_CANARY_SOURCE_CONFLICT',
  'QTX_ISOLATION_AGENTS',
  'QTX_ISOLATION_COMMAND_TIMEOUT_MS',
  'QTX_ISOLATION_SCENARIOS',
] as const

export interface IsolationExecutionPlan {
  image: string
  mountPath: string
  remoteCommand: string
  repoRoot: string
  smokeArgs: string[]
}

export function buildIsolationExecutionPlan(
  options: {
    image?: string
    repoRoot?: string
    smokeArgs?: string[]
  } = {},
): IsolationExecutionPlan {
  const repoRoot = options.repoRoot || process.cwd()
  const image = options.image || DEFAULT_ISOLATION_IMAGE
  const smokeArgs =
    options.smokeArgs && options.smokeArgs.length > 0 ? [...options.smokeArgs] : [...DEFAULT_ISOLATION_SMOKE_ARGS]
  const mountPath = `/mnt/${basename(repoRoot)}`

  return {
    image,
    mountPath,
    remoteCommand: buildRemoteCommand(mountPath, smokeArgs),
    repoRoot,
    smokeArgs,
  }
}

export function quoteForShell(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

function buildRemoteCommand(mountPath: string, smokeArgs: string[]): string {
  const quotedArgs = smokeArgs.map(quoteForShell).join(' ')

  return [
    'set -euo pipefail',
    'export HOME=/tmp/quantex-home',
    'export BUN_INSTALL="$HOME/.bun"',
    'export PATH="$BUN_INSTALL/bin:$HOME/.local/bin:$PATH"',
    ...FORWARDED_ISOLATION_ENV.map(name => `export ${name}=${quoteForShell(process.env[name] ?? '')}`),
    'mkdir -p "$HOME"',
    'rm -rf /tmp/quantex-work',
    `cp -R ${quoteForShell(mountPath)} /tmp/quantex-work`,
    'cd /tmp/quantex-work',
    'bun install --frozen-lockfile --ignore-scripts --no-progress',
    `bun run scripts/smoke/lifecycle-smoke.ts${quotedArgs ? ` ${quotedArgs}` : ''}`,
  ].join(' && ')
}
