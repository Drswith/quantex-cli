import type { OutputMode } from '../cli-context'
import type { CommandResult, CommandTarget, HumanRenderer } from '../output/types'
import type { StableCommandName } from './registry'
import { getCommandContracts } from './registry'

export interface CommandPresentationRoute {
  readonly presenterId: StableCommandName
  presentHuman<T>(result: CommandResult<T>, renderer: HumanRenderer<T>): void
  serializeJson<T>(result: CommandResult<T>): string
  toEvent<T>(event: CommandEventInput<T>): CommandEventInput<T>
  toResultEvent<T>(result: CommandResult<T>): CommandResultEventInput<T>
}

export interface CommandEventInput<T> {
  readonly action: string
  readonly data?: T
  readonly target?: CommandTarget
  readonly type: 'cancelled' | 'progress' | 'result' | 'started'
}

export interface CommandResultEventInput<T> {
  readonly action: string
  readonly data: CommandResult<T>
  readonly target?: CommandTarget
  readonly type: 'result'
}

const presentationRoutes = new Map(
  getCommandContracts().map(contract => [contract.name, createPresentationRoute(contract.presenterId)]),
)

export function getCommandPresentationRoute(action: string): CommandPresentationRoute | undefined {
  return presentationRoutes.get(action as StableCommandName)
}

export function presentCommandResult<T>(
  route: CommandPresentationRoute | undefined,
  mode: OutputMode,
  result: CommandResult<T>,
  renderer: HumanRenderer<T>,
  emitJson: (serialized: string) => void,
  emitResultEvent: (event: CommandResultEventInput<T>) => void,
): void {
  if (mode === 'json') {
    emitJson(route?.serializeJson(result) ?? JSON.stringify(result, null, 2))
    return
  }
  if (mode === 'ndjson') {
    emitResultEvent(route?.toResultEvent(result) ?? createResultEvent(result))
    return
  }

  if (route) route.presentHuman(result, renderer)
  else renderer(result)
}

export function presentCommandEvent<T, EmittedEvent>(
  route: CommandPresentationRoute | undefined,
  mode: OutputMode,
  event: CommandEventInput<T>,
  emitEvent: (event: CommandEventInput<T>) => EmittedEvent,
): EmittedEvent | undefined {
  if (mode !== 'ndjson') return undefined
  return emitEvent(route?.toEvent(event) ?? event)
}

function createPresentationRoute(presenterId: StableCommandName): CommandPresentationRoute {
  return {
    presenterId,
    presentHuman: (result, renderer) => renderer(result),
    serializeJson: result => JSON.stringify(result, null, 2),
    toEvent: event => event,
    toResultEvent: createResultEvent,
  }
}

function createResultEvent<T>(result: CommandResult<T>): CommandResultEventInput<T> {
  return {
    action: result.action,
    data: result,
    target: result.target,
    type: 'result',
  }
}
