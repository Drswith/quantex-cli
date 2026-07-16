import type { ManagedInstallType, PackageTargetKind } from '../agents/types'
import type { NpmBunUpdateStrategy } from '../config'
import type {
  ProviderAdapter,
  ProviderOperationContext,
  ProviderOutcome,
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
import { createCliOperationContext } from '../runtime/cli-operation-context'
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
export type ManagedMutationOutcome = ProviderOutcome<unknown>

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

export interface TypedManagedInstaller extends Omit<
  ManagedInstaller,
  'install' | 'isAvailable' | 'uninstall' | 'update' | 'updateMany'
> {
  isAvailable: (context?: ProviderOperationContext) => Promise<boolean>
  install: (
    packageName: string,
    packageTargetKind?: PackageTargetKind,
    packageInstallArgs?: string[],
    context?: ProviderOperationContext,
  ) => Promise<ManagedMutationOutcome>
  uninstall: (
    packageName: string,
    packageTargetKind?: PackageTargetKind,
    options?: ManagedInstallerUpdateOptions,
    context?: ProviderOperationContext,
  ) => Promise<ManagedMutationOutcome>
  update: (
    packageName: string,
    packageTargetKind?: PackageTargetKind,
    options?: ManagedInstallerUpdateOptions,
    context?: ProviderOperationContext,
  ) => Promise<ManagedMutationOutcome>
  updateMany: (
    packages: ManagedPackageSpec[],
    options?: ManagedInstallerUpdateOptions,
    context?: ProviderOperationContext,
  ) => Promise<ManagedMutationOutcome>
}

interface RegistryManagedInstallerProbes {
  readonly getInstalledVersion: (packageName: string) => Promise<string | undefined>
  readonly probePackagePresence: (packageName: string) => Promise<ManagedPackagePresenceProbe>
}

function createRegistryManagedInstaller(
  type: Extract<ManagedInstallType, 'bun' | 'npm'>,
  adapter: ProviderAdapter,
  probes: RegistryManagedInstallerProbes,
): TypedManagedInstaller {
  return {
    type,
    getInstalledVersion: packageName => probes.getInstalledVersion(packageName),
    probePackagePresence: packageName => probes.probePackagePresence(packageName),
    isAvailable: context =>
      withProviderContext(context, async resolved => (await adapter.availability(resolved)).kind === 'success'),
    install: async (packageName, packageTargetKind, packageInstallArgs, context) => {
      if (!adapter.install) return unsupported('install')
      return withProviderContext(context, resolved =>
        adapter.install!({
          context: resolved,
          target: createProviderTarget(packageName, packageTargetKind, undefined, packageInstallArgs),
        }),
      )
    },
    uninstall: async (packageName, packageTargetKind, options, context) => {
      if (!adapter.uninstall) return unsupported('uninstall')
      return withProviderContext(context, resolved =>
        adapter.uninstall!({
          context: resolved,
          target: createProviderTarget(packageName, packageTargetKind, options?.binaryName),
        }),
      )
    },
    update: async (packageName, packageTargetKind, options, context) => {
      if (!adapter.update) return unsupported('update')
      const operationOptions = createRegistryOperationOptions(options)
      return withProviderContext(context, resolved =>
        adapter.update!({
          context: resolved,
          ...(operationOptions ? { options: operationOptions } : {}),
          target: createProviderTarget(
            packageName,
            packageTargetKind,
            options?.binaryName,
            options?.packageInstallArgs,
          ),
        }),
      )
    },
    updateMany: async (packages, options, context) => {
      if (!adapter.updateMany) return unsupported('update-many')
      const operationOptions = createRegistryOperationOptions(options)
      return withProviderContext(context, resolved =>
        adapter.updateMany!({
          context: resolved,
          ...(operationOptions ? { options: operationOptions } : {}),
          targets: packages.map(pkg =>
            createProviderTarget(pkg.packageName, pkg.packageTargetKind, pkg.binaryName, pkg.packageInstallArgs),
          ),
        }),
      )
    },
  }
}

async function withProviderContext<T>(
  context: ProviderOperationContext | undefined,
  invoke: (context: ProviderOperationContext) => Promise<T>,
): Promise<T> {
  if (context) return invoke(context)
  const operation = createCliOperationContext()
  try {
    return await invoke(operation.context)
  } finally {
    operation.dispose()
  }
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
  compatibility: Pick<TypedManagedInstaller, 'getInstalledVersion' | 'probePackagePresence'> = {},
): TypedManagedInstaller {
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
    isAvailable: context =>
      withProviderContext(context, async resolved => (await adapter.availability(resolved)).kind === 'success'),
    install: async (packageName, packageTargetKind, packageInstallArgs, context) => {
      if (!adapter.install) return unsupported('install')
      return withProviderContext(context, resolved =>
        adapter.install!({ context: resolved, target: target(packageName, packageTargetKind, packageInstallArgs) }),
      )
    },
    uninstall: async (packageName, packageTargetKind, options, context) => {
      if (!adapter.uninstall) return unsupported('uninstall')
      return withProviderContext(context, resolved =>
        adapter.uninstall!({
          context: resolved,
          target: target(packageName, packageTargetKind, undefined, options?.binaryName),
        }),
      )
    },
    update: async (packageName, packageTargetKind, options, context) => {
      if (!adapter.update) return unsupported('update')
      return withProviderContext(context, resolved =>
        adapter.update!({
          context: resolved,
          target: target(packageName, packageTargetKind, options?.packageInstallArgs, options?.binaryName),
        }),
      )
    },
    updateMany: async (packages, _options, context) => {
      if (!adapter.updateMany) return unsupported('update-many')
      return withProviderContext(context, resolved =>
        adapter.updateMany!({
          context: resolved,
          targets: packages.map(pkg =>
            target(pkg.packageName, pkg.packageTargetKind, pkg.packageInstallArgs, pkg.binaryName),
          ),
        }),
      )
    },
  }
}

const typedManagedInstallers: Record<ManagedInstallType, TypedManagedInstaller> = {
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

const managedInstallers = Object.fromEntries(
  Object.entries(typedManagedInstallers).map(([type, installer]) => [type, projectManagedInstaller(installer)]),
) as Record<ManagedInstallType, ManagedInstaller>

export function getManagedInstaller(type: ManagedInstallType): ManagedInstaller {
  return managedInstallers[type]
}

export function getTypedManagedInstaller(type: ManagedInstallType): TypedManagedInstaller {
  return typedManagedInstallers[type]
}

function projectManagedInstaller(installer: TypedManagedInstaller): ManagedInstaller {
  return {
    getInstalledVersion: installer.getInstalledVersion,
    install: async (...args) => (await installer.install(...args)).kind === 'success',
    isAvailable: installer.isAvailable,
    probePackagePresence: installer.probePackagePresence,
    type: installer.type,
    uninstall: async (...args) => (await installer.uninstall(...args)).kind === 'success',
    update: async (...args) => (await installer.update(...args)).kind === 'success',
    updateMany: async (...args) => (await installer.updateMany(...args)).kind === 'success',
  }
}

function unsupported(operation: 'install' | 'uninstall' | 'update' | 'update-many'): ManagedMutationOutcome {
  return { kind: 'unsupported', operation }
}
