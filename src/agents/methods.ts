import type { BinaryInstallMethod, ManagedInstallMethod, PackageTargetKind, ScriptInstallMethod } from './types'

export function bunInstall(packageName?: string): ManagedInstallMethod {
  return {
    packageName,
    type: 'bun',
  }
}

export function npmInstall(packageName?: string): ManagedInstallMethod {
  return {
    packageName,
    type: 'npm',
  }
}

export function brewInstall(packageName: string, packageTargetKind?: PackageTargetKind): ManagedInstallMethod {
  return {
    packageName,
    packageTargetKind,
    type: 'brew',
  }
}

export function wingetInstall(packageName: string): ManagedInstallMethod {
  return {
    packageName,
    packageTargetKind: 'id',
    type: 'winget',
  }
}

export function scriptInstall(command: string): ScriptInstallMethod {
  return {
    command,
    type: 'script',
  }
}

export function binaryInstall(command: string): BinaryInstallMethod {
  return {
    command,
    type: 'binary',
  }
}
