export interface ReleasePrManifest {
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export interface ReleasePrPolicyInput {
  baseBranch: string
  baseVersion: string
  body: string
  changedFiles: string[]
  coreManifest: ReleasePrManifest
  headBranch: string
  rootManifest: ReleasePrManifest
  title: string
}

export function compareReleaseVersions(leftRaw: string, rightRaw: string): number

export function validateReleasePrPolicy(input: ReleasePrPolicyInput): string[]
