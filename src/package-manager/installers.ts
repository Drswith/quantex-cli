import type { ManagedInstallType, PackageTargetKind } from '../agents/types'
import type { NpmBunUpdateStrategy } from '../config'
import {
  isBrewAvailable,
  isBunAvailable,
  isCargoAvailable,
  isNpmAvailable,
  isPipAvailable,
  isWingetAvailable,
} from '../utils/detect'
import * as brewPm from './brew'
import * as bunPm from './bun'
import * as cargoPm from './cargo'
import * as npmPm from './npm'
import * as pipPm from './pip'
import * as wingetPm from './winget'

export interface ManagedPackageSpec {
  packageInstallArgs?: string[]
  packageName: string
  packageTargetKind?: PackageTargetKind
}

export interface ManagedInstallerUpdateOptions {
  npmBunUpdateStrategy?: NpmBunUpdateStrategy
  packageInstallArgs?: string[]
}

export interface ManagedInstaller {
  type: ManagedInstallType
  getInstalledVersion?: (packageName: string, packageTargetKind?: PackageTargetKind) => Promise<string | undefined>
  isAvailable: () => Promise<boolean>
  install: (
    packageName: string,
    packageTargetKind?: PackageTargetKind,
    packageInstallArgs?: string[],
  ) => Promise<boolean>
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
    getInstalledVersion: async packageName => bunPm.getInstalledVersion(packageName),
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
  cargo: {
    type: 'cargo',
    isAvailable: async () => isCargoAvailable(),
    install: async (packageName, _packageTargetKind, packageInstallArgs) =>
      cargoPm.install(packageName, packageInstallArgs),
    uninstall: async packageName => cargoPm.uninstall(packageName),
    update: async (packageName, _packageTargetKind, options) =>
      cargoPm.update(packageName, options?.packageInstallArgs),
    updateMany: async packages =>
      cargoPm.updateMany(
        packages.map(pkg => ({
          packageInstallArgs: pkg.packageInstallArgs,
          packageName: pkg.packageName,
        })),
      ),
  },
  npm: {
    type: 'npm',
    getInstalledVersion: async packageName => npmPm.getInstalledVersion(packageName),
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
  pip: {
    type: 'pip',
    isAvailable: async () => isPipAvailable(),
    install: async packageName => pipPm.install(packageName),
    uninstall: async packageName => pipPm.uninstall(packageName),
    update: async packageName => pipPm.update(packageName),
    updateMany: async packages => pipPm.updateMany(packages.map(pkg => ({ packageName: pkg.packageName }))),
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
