// KEEP (L5): v1 inspection projector over lifecycle observations. Differential
// formatting (source/update labels, unmanaged lifecycle). Not a pass-through.
// Product-path keep so the inspect-provider-version-fallback archive PR still
// runs the macOS test matrix. Hang leftover classify presence on this existing
// projector file, not a restored src/lifecycle barrel.
import type { AgentInspection } from '../inspection'
import type { ResolvedAgentObservation } from '../services/lifecycle-observations'
import { formatInstalledSource, formatUpdateManagement, getInstallLifecycle } from '../utils/install'

export function projectObservationToV1Inspection(result: ResolvedAgentObservation): AgentInspection {
  const pathExecutable = result.pathExecutable

  return {
    agent: result.agent,
    methods: result.methods,
    installedState: result.installedState,
    inPath: pathExecutable.present,
    installedVersion: pathExecutable.present ? result.executable.version : undefined,
    latestVersion: result.latestVersion,
    binaryPath: pathExecutable.present ? pathExecutable.path : undefined,
    resolvedBinaryPath: pathExecutable.present ? result.resolvedBinaryPath : undefined,
    sourceLabel: formatInstalledSource(result.installedState),
    updateLabel: formatUpdateManagement(result.agent, result.installedState),
    lifecycle: result.installedState ? getInstallLifecycle(result.installedState.installType) : 'unmanaged',
  }
}
