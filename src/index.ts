export { claude, codex, getAgentByNameOrAlias, getAllAgents, opencode } from './agents'
export type { AgentDefinition, InstallMethod, InstallType, ManagedInstallType, PackageTargetKind, Platform } from './agents'
export { groupInspectionsForUpdate, inspectAgent, inspectAllAgents } from './agents/inspection'
export { getConfigDir, getConfigFilePath, loadConfig, saveConfig } from './config'
export type { QuantexConfig } from './config'
export { getOrderedInstallMethods, installAgent, uninstallAgent, updateAgent, updateAgentsByType } from './package-manager'
export type { AgentOperationResult, ManagedPackageSpec } from './package-manager'
export {
  getInstalledAgentState,
  getStateFilePath,
  loadState,
  removeInstalledAgentState,
  saveState,
  setInstalledAgentState,
} from './state'
export type { InstalledAgentState, QuantexState } from './state'
export { getPlatform, isBinaryInPath, isBunAvailable, isNpmAvailable } from './utils/detect'
export { execCommand } from './utils/exec'
export { getBinaryPath, getInstalledVersion, getLatestVersion } from './utils/version'
