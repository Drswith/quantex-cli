export {
  getInstalledAgentState,
  getLifecycleReceipt,
  lifecycleReceiptStore,
  getSelfState,
  getStateFilePath,
  getStateLockPath,
  loadState,
  removeInstalledAgentState,
  removeLifecycleReceipt,
  removeSelfInstallSource,
  saveState,
  setInstalledAgentState,
  setLifecycleReceipt,
  setSelfInstallSource,
  setSelfUpdateNoticeState,
  StateFileError,
} from './state/index'
export type { InstalledAgentState, QuantexState, SelfState } from './state/index'
