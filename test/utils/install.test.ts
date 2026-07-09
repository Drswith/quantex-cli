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

  it('adopts a mise-managed existing install when the binary path identifies a mise shim', () => {
    const method = getAdoptableExistingInstallMethod(
      [{ type: 'mise' }, { type: 'npm' }],
      '/tmp/quantex-home/.local/share/mise/shims/codex',
    )

    expect(method).toEqual({ type: 'mise' })
  })

  it('does not adopt a project-local npm install from node_modules/.bin', () => {
    const method = getAdoptableExistingInstallMethod(
      [{ type: 'bun' }, { type: 'npm' }],
      '/workspace/my-app/node_modules/.bin/codex',
    )

    expect(method).toBeUndefined()
  })

  it('adopts a global npm-managed existing install when the binary path identifies a global lib layout', () => {
    const method = getAdoptableExistingInstallMethod(
      [{ type: 'bun' }, { type: 'npm' }],
      '/usr/local/lib/node_modules/@openai/codex/bin/codex',
    )

    expect(method).toEqual({ type: 'npm' })
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

  it('renders uv tool install guidance from uv package metadata and args', () => {
    expect(
      formatInstallMethodCommand(
        {
          packages: {
            pip: 'test-pip-package',
            uv: 'test-tool',
          },
        },
        { packageInstallArgs: ['--python', '3.12'], type: 'uv' },
      ),
    ).toBe('uv tool install test-tool --python 3.12')
  })

  it('renders Deno global install guidance from Deno package metadata and args', () => {
    expect(
      formatInstallMethodCommand(
        {
          packages: {
            deno: 'jsr:@scope/test-tool',
            npm: 'test-pkg',
          },
        },
        { packageInstallArgs: ['--allow-net', '--name', 'test-tool'], type: 'deno' },
      ),
    ).toBe('deno install --global --allow-net --name test-tool jsr:@scope/test-tool')
  })

  it('does not use npm metadata as a Deno package fallback', () => {
    expect(
      formatInstallMethodCommand(
        {
          packages: {
            npm: 'test-pkg',
          },
        },
        { type: 'deno' },
      ),
    ).toBe('')
  })

  it('does not use pip metadata as a uv package fallback', () => {
    expect(
      formatInstallMethodCommand(
        {
          packages: {
            pip: 'test-pip-package',
          },
        },
        { type: 'uv' },
      ),
    ).toBe('')
  })

  it('renders mise install guidance from mise package metadata', () => {
    expect(
      formatInstallMethodCommand(
        {
          packages: {
            mise: 'npm:@openai/codex',
            npm: '@openai/codex',
          },
        },
        { type: 'mise' },
      ),
    ).toBe('mise use --global npm:@openai/codex')
  })
})
