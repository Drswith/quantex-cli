import process from 'node:process'
import { getCliContext } from '../cli-context'

/** Install/ensure only — used by the Core installation compatibility bridge. */
export type InstallationOperation = 'ensure' | 'install'

/** Promoted CLI lifecycle commands that participate in engine routing. */
export type LifecycleEngineOperation = InstallationOperation | 'uninstall' | 'update'

export type InstallationEngineRoute =
  | {
      readonly adoption: 'v1-safe'
      readonly engine: 'core'
      readonly source: 'stable-default' | 'test'
    }
  | {
      readonly engine: 'dry-run-planning'
      readonly source: 'dry-run-compatibility'
    }

const STABLE_CORE_ROUTE: InstallationEngineRoute = Object.freeze({
  adoption: 'v1-safe',
  engine: 'core',
  source: 'stable-default',
})

const DRY_RUN_PLANNING_ROUTE: InstallationEngineRoute = Object.freeze({
  engine: 'dry-run-planning',
  source: 'dry-run-compatibility',
})

/**
 * Apply mutations for install/ensure/update/uninstall always use Core.
 * `QUANTEX_INSTALLATION_ENGINE` is ignored and does not create a second apply route.
 * Install/ensure `--dry-run` keeps the maintained v1 observation short-circuit
 * planner (no mutation) because Core preview does not yet match that frozen plan
 * when provider observation is indeterminate.
 */
export function selectInstallationEngineRoute(operation: LifecycleEngineOperation): InstallationEngineRoute {
  if (operation === 'update' || operation === 'uninstall') return STABLE_CORE_ROUTE
  if (getCliContext().dryRun) return DRY_RUN_PLANNING_ROUTE
  return STABLE_CORE_ROUTE
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
