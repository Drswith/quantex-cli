import type { BinaryInstallMethod, ManagedInstallMethod, PackageTargetKind, ScriptInstallMethod } from './types'

export function bunInstall(priority: number, packageName?: string): ManagedInstallMethod {
  return {
    packageName,
    priority,
    type: 'bun',
  }
}

export function npmInstall(priority: number, packageName?: string): ManagedInstallMethod {
  return {
    packageName,
    priority,
    type: 'npm',
  }
}

export function brewInstall(priority: number, packageName: string, packageTargetKind?: PackageTargetKind): ManagedInstallMethod {
  return {
    packageName,
    packageTargetKind,
    priority,
    type: 'brew',
  }
}

export function wingetInstall(priority: number, packageName: string): ManagedInstallMethod {
  return {
    packageName,
    packageTargetKind: 'id',
    priority,
    type: 'winget',
  }
}

export function scriptInstall(priority: number, command: string): ScriptInstallMethod {
  return {
    command,
    priority,
    type: 'script',
  }
}

export function binaryInstall(priority: number, command: string): BinaryInstallMethod {
  return {
    command,
    priority,
    type: 'binary',
  }
}
