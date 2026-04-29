import { buildIsolationExecutionPlan, DEFAULT_ISOLATION_IMAGE, DEFAULT_ISOLATION_SMOKE_ARGS } from './isolation-shared'

export const DEFAULT_CONTAINER_SANDBOX_IMAGE = DEFAULT_ISOLATION_IMAGE
export const DEFAULT_CONTAINER_SANDBOX_SMOKE_ARGS = DEFAULT_ISOLATION_SMOKE_ARGS

export interface ContainerSandboxInvocation {
  command: string[]
  image: string
  mountPath: string
  remoteCommand: string
  smokeArgs: string[]
}

export function buildContainerSandboxInvocation(
  options: {
    image?: string
    repoRoot?: string
    smokeArgs?: string[]
  } = {},
): ContainerSandboxInvocation {
  const plan = buildIsolationExecutionPlan(options)

  return {
    command: [
      'docker',
      'run',
      '--rm',
      '--volume',
      `${plan.repoRoot}:${plan.mountPath}`,
      '--workdir',
      plan.mountPath,
      '--env',
      'HOME=/tmp/quantex-home',
      '--env',
      'QTX_ISOLATION_AGENTS',
      '--env',
      'QTX_ISOLATION_SCENARIOS',
      plan.image,
      '/bin/bash',
      '-lc',
      plan.remoteCommand,
    ],
    image: plan.image,
    mountPath: plan.mountPath,
    remoteCommand: plan.remoteCommand,
    smokeArgs: plan.smokeArgs,
  }
}

export function getMissingDockerCliMessage(): string {
  return [
    'Container isolation requires a working Docker CLI and running Docker daemon.',
    'Install and start Docker Desktop or another compatible Docker runtime before retrying `bun run test:container`.',
  ].join('\n')
}
