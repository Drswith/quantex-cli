// KEEP (S2): command-contract convenience barrel over registry. Live
// importers in commands/shortcut/schema. Established import path, not a
// leftover shim to inline. Do not expand into a commands/public SDK barrel.
// S2 leftover scan: KEEP product-path hang here (CLI shell leftover; do not restore src/lifecycle).
export {
  getCommandContracts,
  getGlobalOptionDefinitions,
  normalizeCommanderGlobalOptions,
  toV1CommandDescriptor,
  validateCommandContractRegistry,
} from './registry'
export type {
  CommandArgumentDefinition,
  CommandContract,
  CommandEffect,
  CommandOptionDefinition,
  GlobalOptionDefinition,
  GlobalOptionId,
  StableCommandName,
  V1CommandDescriptor,
} from './registry'
