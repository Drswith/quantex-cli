import type { AgentDefinition, InstallType } from './types'
import { getCatalogSupersededPackages, getPackageMetadataKey } from './catalog'

/**
 * Package identity as a recorded install carries it, kept structural so agent
 * metadata does not depend on the state module.
 */
export interface RecordedPackageIdentity {
  installType: InstallType
  packageName?: string
}

export interface SupersededPackageMigration {
  currentPackage?: string
  recordedPackage: string
}

/**
 * Resolves the migration implied by a recorded install whose package identifier the
 * catalog declares superseded. Returns undefined when the recorded identity is still
 * the agent's current one, which is the common case.
 */
export function resolveSupersededPackage(
  agent: Pick<AgentDefinition, 'name' | 'packages'>,
  recorded: RecordedPackageIdentity | undefined,
): SupersededPackageMigration | undefined {
  const recordedPackage = recorded?.packageName
  if (!recorded || !recordedPackage) return undefined

  const key = getPackageMetadataKey(recorded.installType)
  if (!key) return undefined

  if (!getCatalogSupersededPackages(agent.name)?.[key]?.includes(recordedPackage)) return undefined

  return {
    ...(agent.packages?.[key] ? { currentPackage: agent.packages[key] } : {}),
    recordedPackage,
  }
}

export function isSupersededPackage(
  agent: Pick<AgentDefinition, 'name' | 'packages'>,
  recorded: RecordedPackageIdentity | undefined,
): boolean {
  return resolveSupersededPackage(agent, recorded) !== undefined
}
