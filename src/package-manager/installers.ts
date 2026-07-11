import type { ManagedInstallType, PackageTargetKind } from '../agents/types'
import type { NpmBunUpdateStrategy } from '../config'
import type {
  ProviderAdapter,
  ProviderOperationContext,
  ProviderTarget,
  RegistryPackageOperationOptions,
} from '../providers'
import { brewProviderAdapter } from '../providers/adapters/brew'
import { bunProviderAdapter } from '../providers/adapters/bun'
import { cargoProviderAdapter } from '../providers/adapters/cargo'
import { denoProviderAdapter } from '../providers/adapters/deno'
import { miseProviderAdapter } from '../providers/adapters/mise'
import { npmProviderAdapter } from '../providers/adapters/npm'
import { pipProviderAdapter } from '../providers/adapters/pip'
import { uvProviderAdapter } from '../providers/adapters/uv'
import { wingetProviderAdapter } from '../providers/adapters/winget'
import * as bunPm from './bun'
import * as misePm from './mise'
import * as npmPm from './npm'
import * as uvPm from './uv'

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

interface RegistryManagedInstallerProbes {
  readonly getInstalledVersion: (packageName: string) => Promise<string | undefined>
  readonly probePackagePresence: (packageName: string) => Promise<ManagedPackagePresenceProbe>
}

function createRegistryManagedInstaller(
  type: Extract<ManagedInstallType, 'bun' | 'npm'>,
  adapter: ProviderAdapter,
  probes: RegistryManagedInstallerProbes,
): ManagedInstaller {
  return {
    type,
    getInstalledVersion: packageName => probes.getInstalledVersion(packageName),
    probePackagePresence: packageName => probes.probePackagePresence(packageName),
    isAvailable: async () => (await adapter.availability(createProviderContext())).kind === 'success',
    install: async (packageName, packageTargetKind, packageInstallArgs) => {
      if (!adapter.install) return false
      const outcome = await adapter.install({
        context: createProviderContext(),
        target: createProviderTarget(packageName, packageTargetKind, undefined, packageInstallArgs),
      })
      return outcome.kind === 'success'
    },
    uninstall: async (packageName, packageTargetKind, options) => {
      if (!adapter.uninstall) return false
      const outcome = await adapter.uninstall({
        context: createProviderContext(),
        target: createProviderTarget(packageName, packageTargetKind, options?.binaryName),
      })
      return outcome.kind === 'success'
    },
    update: async (packageName, packageTargetKind, options) => {
      if (!adapter.update) return false
      const operationOptions = createRegistryOperationOptions(options)
      const outcome = await adapter.update({
        context: createProviderContext(),
        ...(operationOptions ? { options: operationOptions } : {}),
        target: createProviderTarget(packageName, packageTargetKind, options?.binaryName, options?.packageInstallArgs),
      })
      return outcome.kind === 'success'
    },
    updateMany: async (packages, options) => {
      if (!adapter.updateMany) return false
      const operationOptions = createRegistryOperationOptions(options)
      const outcome = await adapter.updateMany({
        context: createProviderContext(),
        ...(operationOptions ? { options: operationOptions } : {}),
        targets: packages.map(pkg =>
          createProviderTarget(pkg.packageName, pkg.packageTargetKind, pkg.binaryName, pkg.packageInstallArgs),
        ),
      })
      return outcome.kind === 'success'
    },
  }
}

function createProviderContext(): ProviderOperationContext {
  return { signal: new AbortController().signal }
}

function createProviderTarget(
  packageName: string,
  packageTargetKind?: PackageTargetKind,
  binaryName?: string,
  packageInstallArgs?: string[],
): ProviderTarget {
  return {
    ...(packageInstallArgs?.length ? { arguments: packageInstallArgs } : {}),
    ...(binaryName ? { binaryName } : {}),
    id: packageName,
    kind: packageTargetKind ?? 'package',
  }
}

function createRegistryOperationOptions(
  options?: ManagedInstallerUpdateOptions,
): RegistryPackageOperationOptions | undefined {
  return options?.npmBunUpdateStrategy ? { updateStrategy: options.npmBunUpdateStrategy } : undefined
}

function createSystemManagedInstaller(
  type: Extract<ManagedInstallType, 'brew' | 'cargo' | 'deno' | 'mise' | 'pip' | 'uv' | 'winget'>,
  adapter: ProviderAdapter,
  resolveKind: (packageTargetKind?: PackageTargetKind) => ProviderTarget['kind'],
  compatibility: Pick<ManagedInstaller, 'getInstalledVersion' | 'probePackagePresence'> = {},
): ManagedInstaller {
  const target = (
    packageName: string,
    packageTargetKind?: PackageTargetKind,
    packageInstallArgs?: string[],
    binaryName?: string,
  ): ProviderTarget => ({
    ...(packageInstallArgs?.length ? { arguments: packageInstallArgs } : {}),
    ...(binaryName ? { binaryName } : {}),
    id: packageName,
    kind: resolveKind(packageTargetKind),
  })

  return {
    ...compatibility,
    type,
    isAvailable: async () => (await adapter.availability(createProviderContext())).kind === 'success',
    install: async (packageName, packageTargetKind, packageInstallArgs) => {
      if (!adapter.install) return false
      return (
        (
          await adapter.install({
            context: createProviderContext(),
            target: target(packageName, packageTargetKind, packageInstallArgs),
          })
        ).kind === 'success'
      )
    },
    uninstall: async (packageName, packageTargetKind, options) => {
      if (!adapter.uninstall) return false
      return (
        (
          await adapter.uninstall({
            context: createProviderContext(),
            target: target(packageName, packageTargetKind, undefined, options?.binaryName),
          })
        ).kind === 'success'
      )
    },
    update: async (packageName, packageTargetKind, options) => {
      if (!adapter.update) return false
      return (
        (
          await adapter.update({
            context: createProviderContext(),
            target: target(packageName, packageTargetKind, options?.packageInstallArgs, options?.binaryName),
          })
        ).kind === 'success'
      )
    },
    updateMany: async packages => {
      if (!adapter.updateMany) return false
      return (
        (
          await adapter.updateMany({
            context: createProviderContext(),
            targets: packages.map(pkg =>
              target(pkg.packageName, pkg.packageTargetKind, pkg.packageInstallArgs, pkg.binaryName),
            ),
          })
        ).kind === 'success'
      )
    },
  }
}

const managedInstallers: Record<ManagedInstallType, ManagedInstaller> = {
  brew: createSystemManagedInstaller('brew', brewProviderAdapter, kind => (kind === 'cask' ? 'cask' : 'formula')),
  bun: createRegistryManagedInstaller('bun', bunProviderAdapter, {
    getInstalledVersion: packageName => bunPm.getInstalledVersion(packageName),
    probePackagePresence: packageName => bunPm.probePackagePresence(packageName),
  }),
  cargo: createSystemManagedInstaller('cargo', cargoProviderAdapter, () => 'package'),
  deno: createSystemManagedInstaller('deno', denoProviderAdapter, () => 'tool'),
  mise: createSystemManagedInstaller('mise', miseProviderAdapter, () => 'tool', {
    getInstalledVersion: packageName => misePm.getInstalledVersion(packageName),
    probePackagePresence: packageName => misePm.probePackagePresence(packageName),
  }),
  npm: createRegistryManagedInstaller('npm', npmProviderAdapter, {
    getInstalledVersion: packageName => npmPm.getInstalledVersion(packageName),
    probePackagePresence: packageName => npmPm.probePackagePresence(packageName),
  }),
  pip: createSystemManagedInstaller('pip', pipProviderAdapter, () => 'package'),
  uv: createSystemManagedInstaller('uv', uvProviderAdapter, () => 'tool', {
    getInstalledVersion: packageName => uvPm.getInstalledVersion(packageName),
    probePackagePresence: packageName => uvPm.probePackagePresence(packageName),
  }),
  winget: createSystemManagedInstaller('winget', wingetProviderAdapter, () => 'id'),
}

export function getManagedInstaller(type: ManagedInstallType): ManagedInstaller {
  return managedInstallers[type]
}
