// KEEP (S1): published v1 state convenience barrel over src/state/index.
// Compatibility and production importers use this path. Frozen state v2;
// not a leftover pass-through to fold.
// S1 leftover scan: KEEP product-path hang here (thick-area zero-ref; do not restore src/lifecycle).
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
  setAgentLifecycleEvidence,
  setLifecycleReceipt,
  setSelfInstallSource,
  setSelfUpdateNoticeState,
  StateFileError,
} from './state/index'
export type { InstalledAgentState, QuantexState, SelfState } from './state/index'
