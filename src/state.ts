// KEEP (S1): published v1 state convenience barrel over packages/core/src/state.
// Compatibility and production importers use this path. Frozen state v2;
// not a leftover pass-through to fold.
// S1 leftover scan: KEEP product-path hang here (thick-area zero-ref; do not restore src/lifecycle).
import { bindCliStateHost } from './runtime/cli-state-host'

bindCliStateHost()

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
} from '../packages/core/src/state'
export type { InstalledAgentState, QuantexState, SelfState } from '../packages/core/src/state'
