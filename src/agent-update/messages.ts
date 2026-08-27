import type { AgentDefinition } from '../agents'
import type { SupersededPackageMigration } from '../agents/superseded'
import type { CommandWarning } from '../output/types'
import type { AgentUpdateStrategy } from './types'

export function getManualAgentUpdateMessage(agent: Pick<AgentDefinition, 'displayName'>): string {
  return `${agent.displayName} uses a manually managed install source. Please check for updates manually.`
}

export function getUntrackedPathAgentUpdateMessage(agent: Pick<AgentDefinition, 'displayName' | 'name'>): string {
  return `${agent.displayName} is detected on disk but not tracked as a Quantex-managed install. Use \`quantex inspect ${agent.name} --json\` to confirm the source, then reinstall through Quantex if you want \`quantex update --all\` to manage it.`
}

export function getSupersededPackageMessage(
  agent: Pick<AgentDefinition, 'displayName' | 'name'>,
  migration: SupersededPackageMigration,
): string {
  const replacement = migration.currentPackage
    ? `which upstream replaced with ${migration.currentPackage}`
    : 'which upstream no longer publishes'

  return `${agent.displayName} is installed from ${migration.recordedPackage}, ${replacement}. Quantex cannot compare versions across the rename. Run \`quantex uninstall ${agent.name}\` then \`quantex install ${agent.name}\` to move onto the current package.`
}

export function createSupersededPackageWarning(
  agent: Pick<AgentDefinition, 'displayName' | 'name'>,
  migration: SupersededPackageMigration,
): CommandWarning {
  return {
    code: 'AGENT_PACKAGE_SUPERSEDED',
    details: {
      agentName: agent.name,
      ...(migration.currentPackage ? { currentPackage: migration.currentPackage } : {}),
      recordedPackage: migration.recordedPackage,
      suggestedAction: 'reinstall-agent',
      suggestedCommands: [`quantex uninstall ${agent.name}`, `quantex install ${agent.name}`],
    },
    message: getSupersededPackageMessage(agent, migration),
  }
}

export function getAgentUpdateFailureHint(
  agent: Pick<AgentDefinition, 'displayName' | 'homepage' | 'selfUpdate'>,
  strategy: AgentUpdateStrategy,
): string | undefined {
  if (strategy === 'self-update' && agent.selfUpdate)
    return `Try running ${agent.selfUpdate.command.join(' ')} directly.`

  if (strategy === 'manual-hint') return `Check ${agent.homepage} for the recommended update path.`

  return undefined
}
