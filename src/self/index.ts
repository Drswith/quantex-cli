import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as bunPm from '../package-manager/bun'
import * as npmPm from '../package-manager/npm'
import { getLatestVersion } from '../utils/version'

export type SelfInstallSource = 'bun' | 'npm' | 'source' | 'unknown'

export interface SelfInspection {
  canAutoUpdate: boolean
  currentVersion: string
  installSource: SelfInstallSource
  latestVersion?: string
  packageRoot: string
  recommendedUpgradeCommand?: string
}

export interface SelfUpdateResult {
  installSource: SelfInstallSource
  success: boolean
}

const CLI_NPM_PACKAGE_NAME = 'quantex-cli'
const BUN_GLOBAL_PATH_SEGMENT = '/.bun/install/global/'
const NODE_MODULES_SEGMENT = `/node_modules/${CLI_NPM_PACKAGE_NAME}`

export async function inspectSelf(): Promise<SelfInspection> {
  const packageRoot = getPackageRoot()
  const currentVersion = await getCurrentVersion()
  const latestVersion = await getLatestVersion(CLI_NPM_PACKAGE_NAME)
  const installSource = detectSelfInstallSource(packageRoot)

  return {
    canAutoUpdate: canAutoUpdateSelf(installSource),
    currentVersion,
    installSource,
    latestVersion,
    packageRoot,
    recommendedUpgradeCommand: canAutoUpdateSelf(installSource) ? 'quantex upgrade' : undefined,
  }
}

export async function upgradeSelf(inspection?: SelfInspection): Promise<SelfUpdateResult> {
  const resolvedInspection = inspection ?? await inspectSelf()

  if (resolvedInspection.installSource === 'bun') {
    return {
      installSource: resolvedInspection.installSource,
      success: await bunPm.update(CLI_NPM_PACKAGE_NAME),
    }
  }

  if (resolvedInspection.installSource === 'npm') {
    return {
      installSource: resolvedInspection.installSource,
      success: await npmPm.update(CLI_NPM_PACKAGE_NAME),
    }
  }

  return {
    installSource: resolvedInspection.installSource,
    success: false,
  }
}

export function canAutoUpdateSelf(installSource: SelfInstallSource): boolean {
  return installSource === 'bun' || installSource === 'npm'
}

export function detectSelfInstallSource(packageRoot: string): SelfInstallSource {
  const normalizedPath = normalizePath(packageRoot)

  if (normalizedPath.includes(BUN_GLOBAL_PATH_SEGMENT))
    return 'bun'

  if (normalizedPath.includes(NODE_MODULES_SEGMENT))
    return 'npm'

  if (normalizedPath)
    return 'source'

  return 'unknown'
}

async function getCurrentVersion(): Promise<string> {
  const packageJson = await Bun.file(new URL('../../package.json', import.meta.url)).json() as { version?: string }
  return packageJson.version ?? '0.0.0'
}

function getPackageRoot(): string {
  const packageJsonPath = fileURLToPath(new URL('../../package.json', import.meta.url))
  return dirname(packageJsonPath)
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').toLowerCase()
}
