// KEEP (S2): published package root. Star re-export of the v1 compatibility
// facade. Folding this path or expanding it would change the published
// SDK/CLI boundary. Frozen: do not expand commands / public SDK.
// S2 leftover scan: KEEP product-path hang here (CLI shell leftover; do not restore src/lifecycle).
export * from './compatibility'
