import {
  buildIsolationExecutionPlan,
  DEFAULT_ISOLATION_IMAGE,
  DEFAULT_ISOLATION_SMOKE_ARGS,
  quoteForShell,
} from './isolation-shared'

export const DEFAULT_MODAL_SANDBOX_IMAGE = DEFAULT_ISOLATION_IMAGE
export const DEFAULT_MODAL_SANDBOX_SMOKE_ARGS = DEFAULT_ISOLATION_SMOKE_ARGS
export const MODAL_REMOTE_EXIT_CODE_MARKER = '__QTX_MODAL_REMOTE_EXIT_CODE__'

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
  const remoteCommand = buildModalRemoteCommand(plan.remoteCommand)

  return {
    command: [
      'modal',
      'shell',
      '--image',
      plan.image,
      '--add-local',
      plan.repoRoot,
      '--cmd',
      `/bin/bash -lc ${quoteForShell(remoteCommand)}`,
    ],
    image: plan.image,
    mountPath: plan.mountPath,
    remoteCommand,
    smokeArgs: plan.smokeArgs,
  }
}

export function buildModalRemoteCommand(remoteCommand: string): string {
  return [
    'set +e',
    remoteCommand,
    'status=$?',
    `printf '\\n${MODAL_REMOTE_EXIT_CODE_MARKER}=%s\\n' "$status"`,
    'exit "$status"',
  ].join('\n')
}

export function parseModalRemoteExitCode(output: string): number | undefined {
  const markerPattern = new RegExp(`${MODAL_REMOTE_EXIT_CODE_MARKER}=(\\d+)`, 'g')
  let exitCode: number | undefined

  for (const match of output.matchAll(markerPattern)) exitCode = Number(match[1])

  return exitCode
}

export function getMissingModalCliMessage(): string {
  return [
    'Modal sandbox validation requires the `modal` CLI on PATH and an authenticated Modal profile.',
    'Install it with `pip install modal` or your preferred Python tool, then run `modal setup` before retrying.',
  ].join('\n')
}
