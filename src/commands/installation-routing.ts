import process from 'node:process'
import { getCliContext } from '../cli-context'

export type InstallationOperation = 'ensure' | 'install'

export type InstallationEngineRoute =
  | {
      readonly engine: 'legacy'
      readonly source: 'compatibility-escape' | 'dry-run-compatibility'
    }
  | {
      readonly adoption: 'v1-safe'
      readonly engine: 'core'
      readonly source: 'stable-default' | 'test'
    }

const STABLE_CORE_ROUTE: InstallationEngineRoute = Object.freeze({
  adoption: 'v1-safe',
  engine: 'core',
  source: 'stable-default',
})

const COMPATIBILITY_LEGACY_ROUTE: InstallationEngineRoute = Object.freeze({
  engine: 'legacy',
  source: 'compatibility-escape',
})

const DRY_RUN_LEGACY_ROUTE: InstallationEngineRoute = Object.freeze({
  engine: 'legacy',
  source: 'dry-run-compatibility',
})

/** Core is the 1.4 apply default; v1 dry-run and the legacy escape remain whole-invocation routes through 1.5. */
export function selectInstallationEngineRoute(_operation: InstallationOperation): InstallationEngineRoute {
  if (getCliContext().dryRun) return DRY_RUN_LEGACY_ROUTE
  return process.env.QUANTEX_INSTALLATION_ENGINE === 'legacy' ? COMPATIBILITY_LEGACY_ROUTE : STABLE_CORE_ROUTE
}

/** Internal test seam; it is intentionally absent from every package/root export. */
export function createCoreInstallationTestRoute(): InstallationEngineRoute {
  return Object.freeze({ adoption: 'v1-safe', engine: 'core', source: 'test' })
}

export function reportInstallationEngineRoute(operation: InstallationOperation, route: InstallationEngineRoute): void {
  if (getCliContext().logLevel !== 'debug') return
  process.stderr.write(`[quantex:debug] ${operation} engine=${route.engine} source=${route.source}\n`)
}
