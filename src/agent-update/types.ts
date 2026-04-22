import type { AgentDefinition, InstallMethod, ManagedInstallType } from '../agents/types'
import type { InstalledAgentState } from '../state'

export type AgentUpdateStrategy = 'managed' | 'manual-hint' | 'self-update'

export interface AgentUpdateContext {
  agent: Pick<AgentDefinition, 'packages' | 'selfUpdate'>
  methods: Pick<InstallMethod, 'type'>[]
  installedState?: Pick<InstalledAgentState, 'installType' | 'packageName'>
}

export interface AgentUpdateProvider {
  canHandle: (context: AgentUpdateContext) => boolean
  getManagedInstallerType?: (context: AgentUpdateContext) => ManagedInstallType | undefined
  strategy: AgentUpdateStrategy
}
