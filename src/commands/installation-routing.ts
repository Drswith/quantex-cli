import process from 'node:process'
import { getCliContext } from '../cli-context'

/** Install/ensure only — used by the Core installation compatibility bridge. */
export type InstallationOperation = 'ensure' | 'install'

/** Promoted CLI lifecycle commands that participate in engine routing. */
export type LifecycleEngineOperation = InstallationOperation | 'uninstall' | 'update'

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

/**
 * Core is the 1.12 default for install/ensure/update/uninstall.
 * The exact `legacy` escape and install/ensure `--dry-run` planning route remain
 * whole-invocation compatibility paths for install/ensure. Update/uninstall execute
 * the relocated in-repo Core engine (no divergent second engine remains after the move).
 */
export function selectInstallationEngineRoute(operation: LifecycleEngineOperation): InstallationEngineRoute {
  if (operation === 'update' || operation === 'uninstall') return STABLE_CORE_ROUTE
  if (getCliContext().dryRun) return DRY_RUN_LEGACY_ROUTE
  return process.env.QUANTEX_INSTALLATION_ENGINE === 'legacy' ? COMPATIBILITY_LEGACY_ROUTE : STABLE_CORE_ROUTE
}

/** Internal test seam; it is intentionally absent from every package/root export. */
export function createCoreInstallationTestRoute(): InstallationEngineRoute {
  return Object.freeze({ adoption: 'v1-safe', engine: 'core', source: 'test' })
}

export function reportInstallationEngineRoute(
  operation: LifecycleEngineOperation,
  route: InstallationEngineRoute,
): void {
  if (getCliContext().logLevel !== 'debug') return
  process.stderr.write(`[quantex:debug] ${operation} engine=${route.engine} source=${route.source}\n`)
}
