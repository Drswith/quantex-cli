import { describe, expect, it } from 'vitest'
import { getAdoptableExistingInstallMethod } from '../../src/utils/install'

describe('getAdoptableExistingInstallMethod', () => {
  it('adopts a Bun-managed existing install when the binary path identifies Bun global bin', () => {
    const method = getAdoptableExistingInstallMethod(
      [{ type: 'bun' }, { type: 'npm' }],
      '/tmp/quantex-home/.bun/bin/pi',
    )

    expect(method).toEqual({ type: 'bun' })
  })

  it('does not guess between multiple managed methods without an identifying binary path', () => {
    const method = getAdoptableExistingInstallMethod([{ type: 'bun' }, { type: 'npm' }])

    expect(method).toBeUndefined()
  })
})
