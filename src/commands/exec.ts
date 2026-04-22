export type ExecInstallPolicy = 'always' | 'if-missing' | 'never'

export interface ExecCommandOptions {
  assumeYes?: boolean
  dryRun?: boolean
  install?: ExecInstallPolicy
  nonInteractive?: boolean
}
