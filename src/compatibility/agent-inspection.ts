import type { AgentInspection } from '../inspection'
import type { ResolvedAgentObservation } from '../services/lifecycle-observations'
import { formatInstalledSource, formatUpdateManagement, getInstallLifecycle } from '../utils/install'

export function projectObservationToV1Inspection(result: ResolvedAgentObservation): AgentInspection {
  const executable = result.pathExecutable

  return {
    agent: result.agent,
    methods: result.methods,
    installedState: result.installedState,
    inPath: executable.present,
    installedVersion: executable.present ? executable.version : undefined,
    latestVersion: result.latestVersion,
    binaryPath: executable.present ? executable.path : undefined,
    resolvedBinaryPath: executable.present ? result.resolvedBinaryPath : undefined,
    sourceLabel: formatInstalledSource(result.installedState),
    updateLabel: formatUpdateManagement(result.agent, result.installedState),
    lifecycle: result.installedState ? getInstallLifecycle(result.installedState.installType) : 'unmanaged',
  }
}
