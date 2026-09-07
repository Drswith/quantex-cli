// KEEP (S2): published v1 exec types (`ExecCommandOptions` / `ExecInstallPolicy`).
// Compatibility re-exports these types. Type-only module, not a leftover
// pass-through to fold into run.ts (that would pull execution into the type home).
export type ExecInstallPolicy = 'always' | 'if-missing' | 'never'

export interface ExecCommandOptions {
  assumeYes?: boolean
  dryRun?: boolean
  install?: ExecInstallPolicy
  nonInteractive?: boolean
}
