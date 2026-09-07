// KEEP (S1): published v1 planning convenience barrel. Compatibility and
// services import this path. Established facade, not a leftover pass-through.
// S1 leftover scan: KEEP product-path hang here (thick-area zero-ref; do not restore src/lifecycle).
export { createUpdatePlan, isInspectionUpdateAvailable } from './updates'
export type { UpdatePlan, UpdatePlanEntry } from './updates'
