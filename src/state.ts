export {
  getInstalledAgentState,
  getLifecycleReceipt,
  getSelfState,
  getStateFilePath,
  getStateLockPath,
  loadState,
  removeInstalledAgentState,
  removeLifecycleReceipt,
  saveState,
  setInstalledAgentState,
  setLifecycleReceipt,
  setSelfInstallSource,
  setSelfUpdateNoticeState,
  StateFileError,
} from './state/index'
export type { InstalledAgentState, QuantexState, SelfState } from './state/index'
