import type { CommandResult } from './output/types'

export const cliErrorCodes = [
  'AGENT_NOT_FOUND',
  'AGENT_NOT_INSTALLED',
  'CANCELLED',
  'INSTALL_FAILED',
  'INTERACTION_REQUIRED',
  'INVALID_ARGUMENT',
  'MANUAL_ACTION_REQUIRED',
  'NETWORK_ERROR',
  'RESOURCE_LOCKED',
  'TIMEOUT',
  'UNINSTALL_FAILED',
  'UPDATE_FAILED',
  'UPGRADE_FAILED',
] as const

export type CliErrorCode = (typeof cliErrorCodes)[number]

export function getExitCodeForError(code: CliErrorCode): number {
  switch (code) {
    case 'INVALID_ARGUMENT':
      return 2
    case 'AGENT_NOT_FOUND':
      return 3
    case 'AGENT_NOT_INSTALLED':
      return 4
    case 'NETWORK_ERROR':
      return 6
    case 'INTERACTION_REQUIRED':
      return 7
    case 'MANUAL_ACTION_REQUIRED':
      return 8
    case 'RESOURCE_LOCKED':
      return 9
    case 'TIMEOUT':
      return 10
    case 'CANCELLED':
      return 11
    default:
      return 1
  }
}

export function getExitCodeForResult(result: Pick<CommandResult, 'ok' | 'error' | 'exitCode'>): number {
  if (result.exitCode !== undefined) return result.exitCode

  if (result.ok) return 0

  return result.error ? getExitCodeForError(result.error.code) : 1
}
