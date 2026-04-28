import type { ManagedInstallType, PackageTargetKind } from '../agents/types'
import type { NpmBunUpdateStrategy } from '../config'
import { isBrewAvailable, isBunAvailable, isNpmAvailable, isWingetAvailable } from '../utils/detect'
import * as brewPm from './brew'
import * as bunPm from './bun'
import * as npmPm from './npm'
import * as wingetPm from './winget'

export interface ManagedPackageSpec {
  packageName: string
  packageTargetKind?: PackageTargetKind
}

export interface ManagedInstallerUpdateOptions {
  npmBunUpdateStrategy?: NpmBunUpdateStrategy
}

export interface ManagedInstaller {
  type: ManagedInstallType
  isAvailable: () => Promise<boolean>
  install: (packageName: string, packageTargetKind?: PackageTargetKind) => Promise<boolean>
  uninstall: (packageName: string, packageTargetKind?: PackageTargetKind) => Promise<boolean>
  update: (
    packageName: string,
    packageTargetKind?: PackageTargetKind,
    options?: ManagedInstallerUpdateOptions,
  ) => Promise<boolean>
  updateMany: (packages: ManagedPackageSpec[], options?: ManagedInstallerUpdateOptions) => Promise<boolean>
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
    update: async (packageName, _packageTargetKind, options) =>
      bunPm.update(packageName, options?.npmBunUpdateStrategy),
    updateMany: async (packages, options) =>
      bunPm.updateMany(
        packages.map(pkg => pkg.packageName),
        options?.npmBunUpdateStrategy,
      ),
  },
  npm: {
    type: 'npm',
    isAvailable: async () => isNpmAvailable(),
    install: async packageName => npmPm.install(packageName),
    uninstall: async packageName => npmPm.uninstall(packageName),
    update: async (packageName, _packageTargetKind, options) =>
      npmPm.update(packageName, options?.npmBunUpdateStrategy),
    updateMany: async (packages, options) =>
      npmPm.updateMany(
        packages.map(pkg => pkg.packageName),
        options?.npmBunUpdateStrategy,
      ),
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
