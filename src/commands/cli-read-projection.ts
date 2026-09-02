import type { AgentDefinition, InstallMethod } from '../agents'
import type { AgentInspection } from '../inspection'
import type { ResolvedAgentObservation } from '../services/lifecycle-observations'
import { projectObservationToV1Inspection } from '../compatibility/agent-inspection'
import { formatInstallMethodCommand, formatInstallMethodLabel } from '../utils/install'

export interface CliReadAgentSummary {
  aliases: string[]
  binaryName: string
  displayName: string
  installMethods: Array<{
    command: string
    label: string
    type: string
  }>
  name: string
  packageName?: string
  selfUpdateCommands: string[]
}

export interface CliReadInspectionSummary {
  binaryPath?: string
  installed: boolean
  installedVersion?: string
  latestVersion?: string
  lifecycle: 'managed' | 'unmanaged'
  sourceLabel?: string
  updateLabel: string
}

/**
 * Project a Core-backed CLI read observation into the richer v1 inspection rows
 * used by inspect/info/resolve. Do not wrap public SDK inspect() descriptors —
 * that surface is intentionally narrower than these CLI contracts.
 */
export function projectCliReadObservation(resolved: ResolvedAgentObservation): {
  agent: AgentDefinition
  inspection: AgentInspection
  summary: {
    agent: CliReadAgentSummary
    inspection: CliReadInspectionSummary
  }
} {
  const inspection = projectObservationToV1Inspection(resolved)
  const selfUpdateCommands = resolved.agent.selfUpdate
    ? [resolved.agent.selfUpdate.command, ...(resolved.agent.selfUpdate.fallbackCommands ?? [])].map(command =>
        command.join(' '),
      )
    : []

  return {
    agent: resolved.agent,
    inspection,
    summary: {
      agent: {
        aliases: resolved.agent.lookupAliases ?? [],
        binaryName: resolved.agent.binaryName,
        displayName: resolved.agent.displayName,
        installMethods: projectInstallMethods(resolved.agent, inspection.methods),
        name: resolved.agent.name,
        packageName: resolved.agent.packages?.npm,
        selfUpdateCommands,
      },
      inspection: {
        binaryPath: inspection.binaryPath,
        installed: inspection.inPath,
        installedVersion: inspection.installedVersion,
        latestVersion: inspection.latestVersion,
        lifecycle: inspection.lifecycle,
        sourceLabel: inspection.inPath ? inspection.sourceLabel : undefined,
        updateLabel: inspection.updateLabel,
      },
    },
  }
}

export function projectInstallMethods(
  agent: Pick<AgentDefinition, 'packages'>,
  methods: readonly InstallMethod[],
): Array<{ command: string; label: string; type: string }> {
  return methods.map(method => ({
    command: formatInstallMethodCommand(agent, method),
    label: formatInstallMethodLabel(method),
    type: method.type,
  }))
}
