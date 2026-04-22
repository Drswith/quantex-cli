import { describe, expect, it } from 'vitest'
import { getExitCodeForError, getExitCodeForResult } from '../src/errors'

describe('error exit codes', () => {
  it('maps stable cli errors to stable exit codes', () => {
    expect(getExitCodeForError('INVALID_ARGUMENT')).toBe(2)
    expect(getExitCodeForError('AGENT_NOT_FOUND')).toBe(3)
    expect(getExitCodeForError('AGENT_NOT_INSTALLED')).toBe(4)
    expect(getExitCodeForError('NETWORK_ERROR')).toBe(6)
    expect(getExitCodeForError('INTERACTION_REQUIRED')).toBe(7)
    expect(getExitCodeForError('MANUAL_ACTION_REQUIRED')).toBe(8)
    expect(getExitCodeForError('RESOURCE_LOCKED')).toBe(9)
    expect(getExitCodeForError('TIMEOUT')).toBe(10)
    expect(getExitCodeForError('CANCELLED')).toBe(11)
    expect(getExitCodeForError('INSTALL_FAILED')).toBe(1)
  })

  it('prefers explicit exit codes from command results', () => {
    expect(getExitCodeForResult({
      error: {
        code: 'UPDATE_FAILED',
        message: 'update failed',
      },
      exitCode: 42,
      ok: false,
    })).toBe(42)
  })
})
