import { basename } from 'node:path'
import process from 'node:process'

export const DEFAULT_ISOLATION_IMAGE =
  process.env.QTX_ISOLATION_IMAGE ||
  process.env.QTX_MODAL_IMAGE ||
  process.env.MODAL_SANDBOX_IMAGE ||
  'docker.io/oven/bun:1.3.11'

export const DEFAULT_ISOLATION_SMOKE_ARGS: string[] = []

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
    'export PATH="$BUN_INSTALL/bin:$PATH"',
    `export QTX_ISOLATION_AGENTS=${quoteForShell(process.env.QTX_ISOLATION_AGENTS ?? '')}`,
    `export QTX_ISOLATION_SCENARIOS=${quoteForShell(process.env.QTX_ISOLATION_SCENARIOS ?? '')}`,
    'mkdir -p "$HOME"',
    'rm -rf /tmp/quantex-work',
    `cp -R ${quoteForShell(mountPath)} /tmp/quantex-work`,
    'cd /tmp/quantex-work',
    'bun install --frozen-lockfile --ignore-scripts --no-progress',
    `bun run scripts/lifecycle-smoke.ts${quotedArgs ? ` ${quotedArgs}` : ''}`,
  ].join(' && ')
}
