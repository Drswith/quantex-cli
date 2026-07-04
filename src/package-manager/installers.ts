import type { ManagedInstallType, PackageTargetKind } from '../agents/types'
import type { NpmBunUpdateStrategy } from '../config'
import {
  isBrewAvailable,
  isBunAvailable,
  isCargoAvailable,
  isDenoAvailable,
  isMiseAvailable,
  isNpmAvailable,
  isPipAvailable,
  isUvAvailable,
  isWingetAvailable,
} from '../utils/detect'
import * as brewPm from './brew'
import * as bunPm from './bun'
import * as cargoPm from './cargo'
import * as denoPm from './deno'
import * as misePm from './mise'
import * as npmPm from './npm'
import * as pipPm from './pip'
import * as uvPm from './uv'
import * as wingetPm from './winget'

export interface ManagedPackageSpec {
  binaryName?: string
  packageInstallArgs?: string[]
  packageName: string
  packageTargetKind?: PackageTargetKind
}

export interface ManagedInstallerUpdateOptions {
  binaryName?: string
  npmBunUpdateStrategy?: NpmBunUpdateStrategy
  packageInstallArgs?: string[]
}

export type ManagedPackagePresenceProbe = 'present' | 'absent' | 'unknown'

export interface ManagedInstaller {
  type: ManagedInstallType
  getInstalledVersion?: (packageName: string, packageTargetKind?: PackageTargetKind) => Promise<string | undefined>
  probePackagePresence?: (
    packageName: string,
    packageTargetKind?: PackageTargetKind,
  ) => Promise<ManagedPackagePresenceProbe>
  isAvailable: () => Promise<boolean>
  install: (
    packageName: string,
    packageTargetKind?: PackageTargetKind,
    packageInstallArgs?: string[],
  ) => Promise<boolean>
  uninstall: (
    packageName: string,
    packageTargetKind?: PackageTargetKind,
    options?: ManagedInstallerUpdateOptions,
  ) => Promise<boolean>
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
    probePackagePresence: async packageName => bunPm.probePackagePresence(packageName),
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
  deno: {
    type: 'deno',
    isAvailable: async () => isDenoAvailable(),
    install: async (packageName, _packageTargetKind, packageInstallArgs) =>
      denoPm.install(packageName, packageInstallArgs),
    uninstall: async (packageName, _packageTargetKind, options) => denoPm.uninstall(options?.binaryName ?? packageName),
    update: async (packageName, _packageTargetKind, options) => denoPm.update(packageName, options?.packageInstallArgs),
    updateMany: async packages =>
      denoPm.updateMany(
        packages.map(pkg => ({
          binaryName: pkg.binaryName,
          packageInstallArgs: pkg.packageInstallArgs,
          packageName: pkg.packageName,
        })),
      ),
  },
  mise: {
    type: 'mise',
    getInstalledVersion: async packageName => misePm.getInstalledVersion(packageName),
    probePackagePresence: async packageName => misePm.probePackagePresence(packageName),
    isAvailable: async () => isMiseAvailable(),
    install: async packageName => misePm.install(packageName),
    uninstall: async packageName => misePm.uninstall(packageName),
    update: async packageName => misePm.update(packageName),
    updateMany: async packages => misePm.updateMany(packages.map(pkg => ({ packageName: pkg.packageName }))),
  },
  npm: {
    type: 'npm',
    getInstalledVersion: async packageName => npmPm.getInstalledVersion(packageName),
    probePackagePresence: async packageName => npmPm.probePackagePresence(packageName),
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
  uv: {
    type: 'uv',
    getInstalledVersion: async packageName => uvPm.getInstalledVersion(packageName),
    probePackagePresence: async packageName => uvPm.probePackagePresence(packageName),
    isAvailable: async () => isUvAvailable(),
    install: async (packageName, _packageTargetKind, packageInstallArgs) =>
      uvPm.install(packageName, packageInstallArgs),
    uninstall: async packageName => uvPm.uninstall(packageName),
    update: async (packageName, _packageTargetKind, options) => uvPm.update(packageName, options?.packageInstallArgs),
    updateMany: async packages =>
      uvPm.updateMany(
        packages.map(pkg => ({
          packageInstallArgs: pkg.packageInstallArgs,
          packageName: pkg.packageName,
        })),
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
