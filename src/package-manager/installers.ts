import type { ManagedInstallType, PackageTargetKind } from '../agents/types'
import { isBrewAvailable, isBunAvailable, isNpmAvailable, isWingetAvailable } from '../utils/detect'
import * as brewPm from './brew'
import * as bunPm from './bun'
import * as npmPm from './npm'
import * as wingetPm from './winget'

export interface ManagedPackageSpec {
  packageName: string
  packageTargetKind?: PackageTargetKind
}

export interface ManagedInstaller {
  type: ManagedInstallType
  isAvailable: () => Promise<boolean>
  install: (packageName: string, packageTargetKind?: PackageTargetKind) => Promise<boolean>
  uninstall: (packageName: string, packageTargetKind?: PackageTargetKind) => Promise<boolean>
  update: (packageName: string, packageTargetKind?: PackageTargetKind) => Promise<boolean>
  updateMany: (packages: ManagedPackageSpec[]) => Promise<boolean>
}

const managedInstallers: Record<ManagedInstallType, ManagedInstaller> = {
  brew: {
    type: 'brew',
    isAvailable: async () => isBrewAvailable(),
    install: async (packageName, packageTargetKind) => brewPm.install(packageName, packageTargetKind),
    uninstall: async (packageName, packageTargetKind) => brewPm.uninstall(packageName, packageTargetKind),
    update: async (packageName, packageTargetKind) => brewPm.update(packageName, packageTargetKind),
    updateMany: async packages => brewPm.updateMany(packages),
  },
  bun: {
    type: 'bun',
    isAvailable: async () => isBunAvailable(),
    install: async packageName => bunPm.install(packageName),
    uninstall: async packageName => bunPm.uninstall(packageName),
    update: async packageName => bunPm.update(packageName),
    updateMany: async packages => bunPm.updateMany(packages.map(pkg => pkg.packageName)),
  },
  npm: {
    type: 'npm',
    isAvailable: async () => isNpmAvailable(),
    install: async packageName => npmPm.install(packageName),
    uninstall: async packageName => npmPm.uninstall(packageName),
    update: async packageName => npmPm.update(packageName),
    updateMany: async packages => npmPm.updateMany(packages.map(pkg => pkg.packageName)),
  },
  winget: {
    type: 'winget',
    isAvailable: async () => isWingetAvailable(),
    install: async packageName => wingetPm.install(packageName),
    uninstall: async packageName => wingetPm.uninstall(packageName),
    update: async packageName => wingetPm.update(packageName),
    updateMany: async packages => wingetPm.updateMany(packages.map(pkg => ({ packageName: pkg.packageName }))),
  },
}

export function getManagedInstaller(type: ManagedInstallType): ManagedInstaller {
  return managedInstallers[type]
}
