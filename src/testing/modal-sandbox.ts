import {
  buildIsolationExecutionPlan,
  DEFAULT_ISOLATION_IMAGE,
  DEFAULT_ISOLATION_SMOKE_ARGS,
  quoteForShell,
} from './isolation-shared'

export const DEFAULT_MODAL_SANDBOX_IMAGE = DEFAULT_ISOLATION_IMAGE
export const DEFAULT_MODAL_SANDBOX_SMOKE_ARGS = DEFAULT_ISOLATION_SMOKE_ARGS

export interface ModalSandboxInvocation {
  command: string[]
  image: string
  mountPath: string
  remoteCommand: string
  smokeArgs: string[]
}

export function buildModalSandboxInvocation(
  options: {
    image?: string
    repoRoot?: string
    smokeArgs?: string[]
  } = {},
): ModalSandboxInvocation {
  const plan = buildIsolationExecutionPlan(options)

  return {
    command: [
      'modal',
      'shell',
      '--image',
      plan.image,
      '--add-local',
      plan.repoRoot,
      '--cmd',
      `/bin/bash -lc ${quoteForShell(plan.remoteCommand)}`,
    ],
    image: plan.image,
    mountPath: plan.mountPath,
    remoteCommand: plan.remoteCommand,
    smokeArgs: plan.smokeArgs,
  }
}

export function getMissingModalCliMessage(): string {
  return [
    'Modal sandbox validation requires the `modal` CLI on PATH and an authenticated Modal profile.',
    'Install it with `pip install modal` or your preferred Python tool, then run `modal setup` before retrying.',
  ].join('\n')
}
