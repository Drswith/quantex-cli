import type { AgentDefinition } from '../agents'
import { resolveAgent } from '../services/agents'
import { resolveAgentObservation } from '../services/lifecycle-observations'
import { isBinaryInPath } from '../utils/detect'
import { getAdoptableExistingInstallMethod } from '../utils/install'

/**
 * Preserves the v1 no-op contract for an executable that Quantex does not own
 * and cannot safely attribute to exactly one supported installation source.
 */
export async function resolveUnmanagedExternalAgent(agentName: string): Promise<AgentDefinition | undefined> {
  const agent = resolveAgent(agentName)
  if (!agent || !(await isBinaryInPath(agent.binaryName))) return undefined

  const observed = await resolveAgentObservation(agentName)
  if (!observed?.pathExecutable.present || observed.installedState || observed.receipt) return undefined

  const adoptable = getAdoptableExistingInstallMethod(
    observed.methods,
    observed.resolvedBinaryPath ?? observed.pathExecutable.path,
  )
  return adoptable ? undefined : observed.agent
}
