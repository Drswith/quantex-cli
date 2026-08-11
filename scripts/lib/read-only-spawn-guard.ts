import childProcess from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { basename } from 'node:path'
import process from 'node:process'

const BLOCKED_SHELLS = new Set(['bash', 'curl', 'powershell', 'powershell.exe', 'pwsh', 'sh'])
const OBSERVATION_RULES: Record<string, (args: string[]) => boolean> = {
  brew: args => isOneOf(args[0], '--version', 'info', 'list'),
  bun: args => args[0] === '--version' || matches(args, ['pm', '-g', 'ls']) || matches(args, ['pm', '-g', 'untrusted']),
  cargo: args => args[0] === '--version',
  deno: args => args[0] === '--version',
  mise: args => isOneOf(args[0], '--version', 'ls'),
  npm: args => isOneOf(args[0], '--version', 'list', 'root', 'view'),
  pip: args => isOneOf(args[0], '--version', 'list', 'show'),
  pip3: args => isOneOf(args[0], '--version', 'list', 'show'),
  python: args => isReadOnlyPythonPip(args),
  python3: args => isReadOnlyPythonPip(args),
  uv: args => args[0] === '--version' || (args[0] === 'tool' && args[1] === 'list'),
  where: () => true,
  which: () => true,
  winget: args => isOneOf(args[0], '--version', 'list', 'search', 'show'),
}

export function assertReadOnlyCommand(command: readonly string[]): void {
  const [file, ...args] = command
  if (!file) throw blocked(command, 'empty command')

  const executable = basename(file).toLowerCase()
  if (BLOCKED_SHELLS.has(executable)) throw blocked(command, 'shell or script execution effect')

  const providerRule = OBSERVATION_RULES[executable]
  if (providerRule) {
    if (!providerRule(args)) throw blocked(command, `provider mutation or unknown ${executable} operation`)
    return
  }

  if (args.length === 1 && (args[0] === '--version' || args[0] === 'version')) return
  throw blocked(command, 'unknown executable effect')
}

function blocked(command: readonly string[], reason: string): Error {
  return new Error(`READ_ONLY_MUTATION_BLOCKED: ${reason}: ${JSON.stringify(command)}`)
}

function isOneOf(value: string | undefined, ...allowed: string[]): boolean {
  return value !== undefined && allowed.includes(value)
}

function isReadOnlyPythonPip(args: string[]): boolean {
  return args[0] === '-m' && args[1] === 'pip' && isOneOf(args[2], '--version', 'list', 'show')
}

function matches(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((argument, index) => argument === expected[index])
}

function record(command: readonly string[]): void {
  const logPath = process.env.QUANTEX_READ_ONLY_GUARD_LOG
  if (logPath) appendFileSync(logPath, `${JSON.stringify(command)}\n`)
}

function normalizeBunCommand(value: unknown): string[] {
  if (Array.isArray(value) && value.every(argument => typeof argument === 'string')) return value
  if (
    typeof value === 'object' &&
    value !== null &&
    'cmd' in value &&
    Array.isArray(value.cmd) &&
    value.cmd.every(argument => typeof argument === 'string')
  ) {
    return value.cmd
  }
  throw blocked([], 'unsupported Bun spawn input')
}

export function normalizeNodeCommand(file: unknown, argsOrOptions: unknown): string[] {
  if (typeof file !== 'string') throw blocked([], 'unsupported Node spawn executable')
  if (argsOrOptions === undefined || !Array.isArray(argsOrOptions)) return [file]
  if (!argsOrOptions.every(argument => typeof argument === 'string')) {
    throw blocked([file], 'unsupported Node spawn arguments')
  }
  const command = [file, ...argsOrOptions]
  return unwrapCrossSpawnWindowsShell(command) ?? command
}

function unwrapCrossSpawnWindowsShell(command: string[]): string[] | undefined {
  const [file, ...args] = command
  if (!file || !['cmd', 'cmd.exe'].includes(basename(file).toLowerCase())) return undefined
  if (
    args.length !== 4 ||
    args[0]?.toLowerCase() !== '/d' ||
    args[1]?.toLowerCase() !== '/s' ||
    args[2]?.toLowerCase() !== '/c'
  ) {
    throw blocked(command, 'unsupported Windows command-shell wrapper')
  }

  const shellCommand = args[3]
  if (!shellCommand?.startsWith('"') || !shellCommand.endsWith('"')) {
    throw blocked(command, 'unsupported Windows command-shell payload')
  }
  const encodedTokens = splitCrossSpawnShellTokens(shellCommand.slice(1, -1))
  const [encodedFile, ...encodedArgs] = encodedTokens
  if (!encodedFile) throw blocked(command, 'empty Windows command-shell payload')

  const decodedFile = decodeCaretEscapes(encodedFile)
  if (decodedFile.includes('"')) throw blocked(command, 'unsupported Windows executable quoting')
  return [decodedFile, ...encodedArgs.map(argument => decodeCrossSpawnArgument(argument, command))]
}

function splitCrossSpawnShellTokens(value: string): string[] {
  const tokens: string[] = []
  let token = ''
  for (const character of value) {
    if (character === ' ' && trailingCaretCount(token) % 2 === 0) {
      if (!token) throw blocked([], 'empty Windows command-shell token')
      tokens.push(token)
      token = ''
    } else {
      token += character
    }
  }
  if (token) tokens.push(token)
  return tokens
}

function trailingCaretCount(value: string): number {
  let count = 0
  for (let index = value.length - 1; index >= 0 && value[index] === '^'; index -= 1) count += 1
  return count
}

function decodeCrossSpawnArgument(value: string, command: readonly string[]): string {
  let decoded = decodeCaretEscapes(value)
  if (decoded.startsWith('^"') && decoded.endsWith('^"')) decoded = decodeCaretEscapes(decoded)
  if (!decoded.startsWith('"') || !decoded.endsWith('"')) {
    throw blocked(command, 'unsupported Windows command-shell argument')
  }
  const argument = decoded.slice(1, -1)
  if (argument.includes('"')) throw blocked(command, 'unsupported Windows argument quoting')
  return argument
}

function decodeCaretEscapes(value: string): string {
  let decoded = ''
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character !== '^') {
      decoded += character
      continue
    }
    const escaped = value[index + 1]
    if (escaped === undefined) throw blocked([], 'dangling Windows command-shell escape')
    decoded += escaped
    index += 1
  }
  return decoded
}

function guard(command: readonly string[]): void {
  assertReadOnlyCommand(command)
  record(command)
}

if (process.env.QUANTEX_READ_ONLY_GUARD === '1') {
  const originalNodeSpawn = childProcess.spawn.bind(childProcess)
  childProcess.spawn = ((file: unknown, argsOrOptions?: unknown, options?: unknown) => {
    guard(normalizeNodeCommand(file, argsOrOptions))
    return Reflect.apply(originalNodeSpawn, childProcess, [file, argsOrOptions, options])
  }) as typeof childProcess.spawn

  const originalNodeSpawnSync = childProcess.spawnSync.bind(childProcess)
  childProcess.spawnSync = ((file: unknown, argsOrOptions?: unknown, options?: unknown) => {
    guard(normalizeNodeCommand(file, argsOrOptions))
    return Reflect.apply(originalNodeSpawnSync, childProcess, [file, argsOrOptions, options])
  }) as typeof childProcess.spawnSync

  const originalSpawn = Bun.spawn.bind(Bun)
  Bun.spawn = ((commandOrOptions: unknown, options?: unknown) => {
    const command = normalizeBunCommand(commandOrOptions)
    guard(command)
    return originalSpawn(commandOrOptions as never, options as never)
  }) as typeof Bun.spawn

  if (typeof Bun.spawnSync === 'function') {
    const originalSpawnSync = Bun.spawnSync.bind(Bun)
    Bun.spawnSync = ((commandOrOptions: unknown, options?: unknown) => {
      const command = normalizeBunCommand(commandOrOptions)
      guard(command)
      return originalSpawnSync(commandOrOptions as never, options as never)
    }) as typeof Bun.spawnSync
  }
}
