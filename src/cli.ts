#!/usr/bin/env node

import process from 'node:process'
import { getAgentByNameOrAlias } from './agents'
import { resetCliContext, resolveCliContext, setCliContext } from './cli-context'
import { createCliProgram } from './command-contract/commander'
import { runCommand } from './commands/run'
import { resolveShortcutInvocation } from './commands/shortcut'
import { pc } from './utils/color'

const program = createCliProgram()
const knownCommands = new Set([
  ...program.commands.map(command => command.name()),
  ...program.commands.flatMap(command => command.aliases()),
  'help',
  '--help',
  '--version',
  '-v',
])

const shortcutInvocation = resolveShortcutInvocation(process.argv.slice(2), knownCommands, {
  agentFriendly: process.stdin.isTTY === false || process.stdout.isTTY === false,
})

if (shortcutInvocation?.error) {
  console.log(pc.red(shortcutInvocation.error))
  process.exit(2)
}

if (shortcutInvocation) {
  const agent = getAgentByNameOrAlias(shortcutInvocation.agentName)
  if (agent) {
    try {
      setCliContext(
        resolveCliContext({
          color: shortcutInvocation.color,
          dryRun: shortcutInvocation.dryRun,
          idempotencyKey: shortcutInvocation.idempotencyKey,
          logLevel: shortcutInvocation.logLevel,
          noCache: shortcutInvocation.noCache,
          nonInteractive: shortcutInvocation.nonInteractive,
          quiet: shortcutInvocation.quiet,
          refresh: shortcutInvocation.refresh,
          runId: shortcutInvocation.runId,
          timeout: shortcutInvocation.timeout,
          yes: shortcutInvocation.yes,
        }),
      )
    } catch (error) {
      console.log(pc.red(error instanceof Error ? error.message : String(error)))
      process.exit(2)
    }
    try {
      const code = await runCommand(shortcutInvocation.agentName, shortcutInvocation.agentArgs, {
        assumeYes: shortcutInvocation.yes,
        dryRun: shortcutInvocation.dryRun,
        nonInteractive: shortcutInvocation.nonInteractive,
      })
      process.exit(code)
    } finally {
      resetCliContext()
    }
  }
}

await program.parseAsync()
