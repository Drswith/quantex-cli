export type ExecInstallPolicy = 'always' | 'if-missing' | 'never'

export interface ExecCommandOptions {
  install?: ExecInstallPolicy
  nonInteractive?: boolean
}
