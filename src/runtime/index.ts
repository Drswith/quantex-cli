// KEEP (S1): established runtime convenience barrel (ports, process, cache,
// invocation, CLI operation context). Live importers in Core/self/services.
// Star re-exports still add a stable import path; not a leftover shell.
// S1 leftover scan: KEEP product-path hang here (thick-area zero-ref; do not restore src/lifecycle).
export * from './agent-process'
export * from './cli-operation-context'
export * from './child-process'
export * from './fetch-network'
export * from './invocation-context'
export * from './ports'
export * from './version-cache'
