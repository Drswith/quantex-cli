import { describe, expect, it } from 'vitest'
import {
  appendFailureReason,
  buildInstallationFailureDetails,
  isProviderUnavailableReason,
  PROVIDER_UNAVAILABLE_LIFECYCLE,
} from '../../src/commands/installation-failure-diagnostics'

describe('installation failure diagnostics', () => {
  it('keeps the lifecycle marker and adds the reason', () => {
    expect(buildInstallationFailureDetails({ reason: 'deno executable is unavailable' }, 'state-write-failed')).toEqual(
      {
        lifecycle: 'state-write-failed',
        reason: 'deno executable is unavailable',
      },
    )
  })

  it('omits absent fields rather than emitting undefined', () => {
    const details = buildInstallationFailureDetails({ reason: 'npm install failed with exit code 1' })

    expect(details).toEqual({ reason: 'npm install failed with exit code 1' })
    expect(Object.keys(details!)).not.toContain('remediation')
    expect(Object.keys(details!)).not.toContain('lifecycle')
  })

  it('carries provider remediation alongside the reason', () => {
    expect(
      buildInstallationFailureDetails({ reason: 'uv tool install failed', remediation: 'Install uv, then retry.' }),
    ).toEqual({
      reason: 'uv tool install failed',
      remediation: 'Install uv, then retry.',
    })
  })

  it('returns undefined when there is nothing to report', () => {
    expect(buildInstallationFailureDetails({})).toBeUndefined()
    expect(buildInstallationFailureDetails({ reason: '   ' })).toBeUndefined()
  })

  it('appends the reason without doubling the sentence terminator', () => {
    expect(appendFailureReason('Failed to install Genie.', 'deno executable is unavailable')).toBe(
      'Failed to install Genie: deno executable is unavailable',
    )
  })

  it('leaves the message untouched when there is no reason', () => {
    expect(appendFailureReason('Failed to install Genie.', undefined)).toBe('Failed to install Genie.')
    expect(appendFailureReason('Failed to install Genie.', '  ')).toBe('Failed to install Genie.')
  })

  it('recognizes the resolver reason for an unavailable provider', () => {
    expect(
      isProviderUnavailableReason(
        'No installation provider is currently available: deno: deno executable is unavailable',
      ),
    ).toBe(true)
    expect(isProviderUnavailableReason('install effect failed with exit code 1')).toBe(false)
    expect(isProviderUnavailableReason(undefined)).toBe(false)
  })

  it('exposes a stable marker for consumers that must not match prose', () => {
    expect(PROVIDER_UNAVAILABLE_LIFECYCLE).toBe('provider-unavailable')
  })
})
