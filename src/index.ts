export { claude, codex, copilot, cursor, droid, gemini, getAgentByLookupName, getAgentByNameOrAlias, getAllAgents, opencode, pi } from './agents'
export type {
  AgentDefinition,
  AgentPackageMetadata,
  BinaryInstallMethod,
  InstallMethod,
  InstallType,
  ManagedInstallMethod,
  ManagedInstallType,
  PackageTargetKind,
  Platform,
  ScriptInstallMethod,
} from './agents'
export { getConfigDir, getConfigFilePath, loadConfig, saveConfig } from './config'
export type { QuantexConfig } from './config'
export { inspectAgent, inspectAllAgents } from './inspection'
export type { AgentInspection } from './inspection'
export { getOrderedInstallMethods, installAgent, uninstallAgent, updateAgent, updateAgentsByType } from './package-manager'
export type { AgentOperationResult, ManagedPackageSpec } from './package-manager'
export {
  canLookupLatestVersionForInstallType,
  canUninstallInstallType,
  canUpdateInstallType,
  getInstallerCapabilities,
  getInstallLifecycle,
  isManagedInstallType,
} from './package-manager/capabilities'
export { getManagedInstaller } from './package-manager/installers'
export type { ManagedInstaller } from './package-manager/installers'
export { createUpdatePlan, isInspectionUpdateAvailable } from './planning'
export type { UpdatePlan, UpdatePlanEntry } from './planning'
export { getSingleAgentUpdateStatus, inspectRegisteredAgents, planAgentUpdates, resolveAgent, resolveAgentInspection } from './services'
export type {
  ManagedUpdateBucket,
  PendingAgentUpdate,
  PlannedAgentUpdates,
  ResolvedAgentInspection,
  SingleAgentUpdateStatus,
} from './services'
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
