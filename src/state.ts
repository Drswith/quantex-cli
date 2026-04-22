export {
  getInstalledAgentState,
  getSelfState,
  getStateFilePath,
  getStateLockPath,
  loadState,
  removeInstalledAgentState,
  saveState,
  setInstalledAgentState,
  setSelfInstallSource,
} from './state/index'
export type { InstalledAgentState, QuantexState, SelfState } from './state/index'
