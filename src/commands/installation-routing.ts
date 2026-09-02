import process from 'node:process'
import { getCliContext } from '../cli-context'

/** Install/ensure only — used by the Core installation compatibility bridge. */
export type InstallationOperation = 'ensure' | 'install'

/** Promoted CLI lifecycle commands that participate in engine routing. */
export type LifecycleEngineOperation = InstallationOperation | 'uninstall' | 'update'

export type InstallationEngineRoute = {
  readonly adoption: 'v1-safe'
  readonly engine: 'core'
  readonly source: 'stable-default' | 'test'
}

const STABLE_CORE_ROUTE: InstallationEngineRoute = Object.freeze({
  adoption: 'v1-safe',
  engine: 'core',
  source: 'stable-default',
})

/**
 * Core is the only whole-invocation engine for install/ensure/update/uninstall.
 * `QUANTEX_INSTALLATION_ENGINE` is ignored and does not create a second route.
 * Install/ensure `--dry-run` uses Core preview through the CLI session.
 */
export function selectInstallationEngineRoute(_operation: LifecycleEngineOperation): InstallationEngineRoute {
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
