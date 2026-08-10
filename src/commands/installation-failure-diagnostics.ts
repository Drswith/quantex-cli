/**
 * Diagnostic projection for failed lifecycle mutations.
 *
 * The executor already carries the evidence a caller needs — the resolver writes
 * reasons like `No installation provider is currently available: deno: ...` and
 * `install effect failed with exit code 1`. Every CLI failure mapper used to route
 * on the failure code alone and drop that text, leaving `Failed to install X.` as
 * the entire failure surface. This module is the single place that turns a failure
 * into the `details` payload, so the Core and legacy engines cannot disagree.
 *
 * The projected reason is diagnostic only. Nothing in Quantex may branch
 * reconciliation, routing, or compensation on its text.
 */

/** Marker written to `details.lifecycle` when no provider is installable here. */
export const PROVIDER_UNAVAILABLE_LIFECYCLE = 'provider-unavailable'

/** Prefix the recipe resolver uses when every candidate provider is unavailable. */
const PROVIDER_UNAVAILABLE_REASON_PREFIX = 'No installation provider is currently available'

/**
 * Deliberately narrow. The Core executor also knows `phase` and `retryable`, but
 * the legacy engine has no equivalent for either, and the legacy/Core
 * differential gate requires the two engines to be indistinguishable from their
 * CLI payload. `lifecycle` already encodes the stage, so the extra fields would
 * buy a nuance at the cost of the contract.
 */
export interface MutationFailureDiagnostics {
  /** Free-form provider evidence. Never branch behavior on this. */
  readonly reason?: string
  readonly remediation?: string
}

export interface InstallationFailureDetails extends Record<string, unknown> {
  readonly lifecycle?: string
}

/**
 * Build the `CommandError.details` payload for a failed mutation.
 *
 * `lifecycle` keeps its existing meaning and is passed through unchanged, so
 * consumers matching on it see no new value unless the caller asks for one.
 * Absent fields are omitted rather than emitted as `undefined`, which keeps the
 * JSON payload stable for callers that enumerate keys.
 */
export function buildInstallationFailureDetails(
  diagnostics: MutationFailureDiagnostics,
  lifecycle?: string,
): InstallationFailureDetails | undefined {
  const reason = diagnostics.reason?.trim()
  const remediation = diagnostics.remediation?.trim()
  const details: Record<string, unknown> = {
    ...(lifecycle ? { lifecycle } : {}),
    ...(reason ? { reason } : {}),
    ...(remediation ? { remediation } : {}),
  }
  return Object.keys(details).length > 0 ? details : undefined
}

/**
 * Append the reason to a message that would otherwise carry no information.
 *
 * Only the generic branch calls this. Messages that already name a specific
 * failure mode stay byte-identical and surface the reason through `details`.
 */
export function appendFailureReason(message: string, reason?: string): string {
  const trimmed = reason?.trim()
  if (!trimmed) return message
  return `${message.replace(/\.$/, '')}: ${trimmed}`
}

/**
 * Whether the failure means no provider could run at all on this platform.
 *
 * Matched here, once, against the resolver's own prefix so that consumers — the
 * agent canary above all — key on a typed marker instead of re-matching prose.
 */
export function isProviderUnavailableReason(reason?: string): boolean {
  return reason?.trimStart().startsWith(PROVIDER_UNAVAILABLE_REASON_PREFIX) ?? false
}
