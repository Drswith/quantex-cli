export interface ReleasePrPolicyInput {
  baseBranch: string
  baseVersion: string
  body: string
  changedFiles: string[]
  headBranch: string
  title: string
}

export function compareReleaseVersions(leftRaw: string, rightRaw: string): number

export function validateReleasePrPolicy(input: ReleasePrPolicyInput): string[]
