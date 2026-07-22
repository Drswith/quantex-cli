import type { InstallType, ManagedInstallType } from '../agents/types'

const managedInstallTypes = Object.freeze([
  'bun',
  'npm',
  'brew',
  'cargo',
  'deno',
  'mise',
  'pip',
  'uv',
  'winget',
] as const satisfies readonly ManagedInstallType[])

export function getManagedInstallTypes(): readonly ManagedInstallType[] {
  return managedInstallTypes
}

export function isManagedInstallType(type: InstallType): type is ManagedInstallType {
  return managedInstallTypes.includes(type as ManagedInstallType)
}
