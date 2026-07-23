import process from 'node:process'
import { getCliContext } from '../cli-context'

export type InstallationOperation = 'ensure' | 'install'

export type InstallationEngineRoute =
  | {
      readonly engine: 'legacy'
      readonly source: 'stable-default'
    }
  | {
      readonly adoption: 'v1-safe'
      readonly engine: 'core'
      readonly source: 'test'
    }

const STABLE_LEGACY_ROUTE: InstallationEngineRoute = Object.freeze({
  engine: 'legacy',
  source: 'stable-default',
})

/** The production selector stays legacy-only until the 5.5 promotion matrix passes. */
export function selectInstallationEngineRoute(_operation: InstallationOperation): InstallationEngineRoute {
  return STABLE_LEGACY_ROUTE
}

/** Internal test seam; it is intentionally absent from every package/root export. */
export function createCoreInstallationTestRoute(): InstallationEngineRoute {
  return Object.freeze({ adoption: 'v1-safe', engine: 'core', source: 'test' })
}

export function reportInstallationEngineRoute(operation: InstallationOperation, route: InstallationEngineRoute): void {
  if (getCliContext().logLevel !== 'debug') return
  process.stderr.write(`[quantex:debug] ${operation} engine=${route.engine} source=${route.source}\n`)
}
