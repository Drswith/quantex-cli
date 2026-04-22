import type { LogLevel } from '../cli-context'
import process from 'node:process'
import { getCliContext } from '../cli-context'

const logLevelPriority: Record<LogLevel, number> = {
  debug: 4,
  error: 1,
  info: 3,
  silent: 0,
  warn: 2,
}

export function printInfo(message: string): void {
  if (shouldPrint('info'))
    process.stdout.write(`${message}\n`)
}

export function printWarn(message: string): void {
  if (shouldPrint('warn'))
    process.stdout.write(`${message}\n`)
}

export function printError(message: string): void {
  if (shouldPrint('error'))
    process.stdout.write(`${message}\n`)
}

export function shouldPrint(level: Exclude<LogLevel, 'silent'>): boolean {
  const context = getCliContext()
  if (context.outputMode !== 'human')
    return true

  if (context.quiet && level === 'info')
    return false

  return logLevelPriority[context.logLevel ?? 'info'] >= logLevelPriority[level]
}

export function isAssumeYesEnabled(): boolean {
  return Boolean(getCliContext().assumeYes)
}

export function isDryRunEnabled(): boolean {
  return Boolean(getCliContext().dryRun)
}

export function writeDirectOutput(message: string): void {
  process.stdout.write(`${message}\n`)
}
