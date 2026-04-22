export { agentUpdateProviders, canResolveAgentUpdate, getAgentUpdateFailureHint, getAgentUpdateStrategy, getManualAgentUpdateMessage, resolveAgentUpdateProvider } from './agent-update'
export type { AgentUpdateContext, AgentUpdateProvider, AgentUpdateStrategy } from './agent-update'
export { claude, codex, copilot, cursor, droid, gemini, getAgentByLookupName, getAgentByNameOrAlias, getAllAgents, opencode, pi } from './agents'
export type {
  AgentDefinition,
  AgentPackageMetadata,
  AgentSelfUpdate,
  AgentVersionProbe,
  BinaryInstallMethod,
  InstallMethod,
  InstallType,
  ManagedInstallMethod,
  ManagedInstallType,
  PackageTargetKind,
  Platform,
  ScriptInstallMethod,
} from './agents'
export { getCliContext, resetCliContext, resolveCliContext, setCliContext } from './cli-context'
export type { CliContext, CliContextOptions, OutputMode } from './cli-context'
export { capabilitiesCommand } from './commands/capabilities'
export { ensureCommand } from './commands/ensure'
export type { ExecCommandOptions, ExecInstallPolicy } from './commands/exec'
export { inspectCommand } from './commands/inspect'
export { getConfigDir, getConfigFilePath, loadConfig, saveConfig } from './config'
export type { QuantexConfig } from './config'
export { getExitCodeForError, getExitCodeForResult } from './errors'
export type { CliErrorCode } from './errors'
export { inspectAgent, inspectAllAgents } from './inspection'
export type { AgentInspection } from './inspection'
export { createErrorResult, createSuccessResult, emitCommandResult } from './output'
export type { CommandError, CommandMeta, CommandResult, CommandTarget, CommandWarning, HumanRenderer } from './output/types'
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
export { createReleaseManifest, formatChecksums, normalizeRepositoryUrl, parseBinaryTarget, parseChecksums, resolveReleaseChannel, validateReleaseManifest } from './release-artifacts'
export type { ReleaseArtifactTarget, ReleaseChannel, ReleaseManifest, ReleaseManifestAsset } from './release-artifacts'
export {
  canAutoUpdateSelf,
  detectSelfInstallSource,
  getBinaryReleaseAssetName,
  getBinaryReleaseDownloadUrl,
  getManualSelfUpgradeCommand,
  getSelfUpgradeRecoveryHint,
  getSelfUpgradeRecoveryHintForInspection,
  getSelfVersion,
  inspectSelf,
  upgradeSelf,
} from './self'
export type { SelfInspection, SelfInstallSource, SelfUpdateResult } from './self'
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
  getSelfState,
  getStateFilePath,
  loadState,
  removeInstalledAgentState,
  saveState,
  setInstalledAgentState,
  setSelfInstallSource,
} from './state'
export type { InstalledAgentState, QuantexState, SelfState } from './state'
export { getPlatform, isBinaryInPath, isBunAvailable, isNpmAvailable } from './utils/detect'
export { execCommand } from './utils/exec'
export { getBinaryPath, getInstalledVersion, getLatestVersion } from './utils/version'
