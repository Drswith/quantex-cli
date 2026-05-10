import { describe, expect, it } from 'vitest'
import { formatInstallMethodCommand, getAdoptableExistingInstallMethod } from '../../src/utils/install'

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

describe('formatInstallMethodCommand', () => {
  it('renders cargo install guidance from cargo package metadata', () => {
    expect(
      formatInstallMethodCommand(
        {
          packages: {
            cargo: 'test-crate',
            npm: 'test-pkg',
          },
        },
        { packageInstallArgs: ['--locked'], type: 'cargo' },
      ),
    ).toBe('cargo install test-crate --locked')
  })

  it('does not use npm metadata as a cargo crate fallback', () => {
    expect(
      formatInstallMethodCommand(
        {
          packages: {
            npm: 'test-pkg',
          },
        },
        { type: 'cargo' },
      ),
    ).toBe('')
  })
})
