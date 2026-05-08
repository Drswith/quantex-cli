import { describe, expect, it } from 'vitest'
import {
  buildSelfManagedRegistryMetadata,
  parsePackedTarballName,
  resolveBunGlobalBinaryPath,
  SEEDED_SELF_VERSION,
} from '../../src/testing/self-upgrade-sandbox'

describe('buildSelfManagedRegistryMetadata', () => {
  it('publishes the current version as latest and keeps the seeded older version installable', () => {
    const metadata = buildSelfManagedRegistryMetadata({
      latestPackageManifest: {
        bin: {
          qtx: './dist/cli.mjs',
          quantex: './dist/cli.mjs',
        },
        dependencies: {
          commander: '^14.0.3',
        },
        name: 'quantex-cli',
        type: 'module',
        version: '0.15.1',
      },
      latestTarballName: 'quantex-cli-0.15.1.tgz',
      origin: 'http://127.0.0.1:4873',
      seededPackageManifest: {
        bin: {
          qtx: './dist/cli.mjs',
          quantex: './dist/cli.mjs',
        },
        dependencies: {
          commander: '^14.0.3',
        },
        name: 'quantex-cli',
        type: 'module',
        version: SEEDED_SELF_VERSION,
      },
      seededTarballName: 'quantex-cli-0.0.0-sandbox-old.tgz',
    })

    expect(metadata.name).toBe('quantex-cli')
    expect(metadata['dist-tags'].latest).toBe('0.15.1')
    expect(metadata.versions[SEEDED_SELF_VERSION]).toEqual({
      bin: {
        qtx: './dist/cli.mjs',
        quantex: './dist/cli.mjs',
      },
      dependencies: {
        commander: '^14.0.3',
      },
      dist: {
        tarball: 'http://127.0.0.1:4873/quantex-cli-0.0.0-sandbox-old.tgz',
      },
      name: 'quantex-cli',
      type: 'module',
      version: SEEDED_SELF_VERSION,
    })
    expect(metadata.versions['0.15.1']).toEqual({
      bin: {
        qtx: './dist/cli.mjs',
        quantex: './dist/cli.mjs',
      },
      dependencies: {
        commander: '^14.0.3',
      },
      dist: {
        tarball: 'http://127.0.0.1:4873/quantex-cli-0.15.1.tgz',
      },
      name: 'quantex-cli',
      type: 'module',
      version: '0.15.1',
    })
  })
})

describe('parsePackedTarballName', () => {
  it('returns the last non-empty line from package pack output', () => {
    expect(parsePackedTarballName('\nquantex-cli-0.15.1.tgz\n')).toBe('quantex-cli-0.15.1.tgz')
    expect(parsePackedTarballName('npm notice something\nquantex-cli-0.15.1.tgz\n')).toBe('quantex-cli-0.15.1.tgz')
    expect(parsePackedTarballName('quantex-cli-0.15.1.tgz')).toBe('quantex-cli-0.15.1.tgz')
    expect(parsePackedTarballName('/tmp/quantex-self-managed/registry/quantex-cli-0.15.1.tgz')).toBe(
      'quantex-cli-0.15.1.tgz',
    )
  })

  it('returns undefined when pack output is empty', () => {
    expect(parsePackedTarballName('\n\n')).toBeUndefined()
  })
})

describe('resolveBunGlobalBinaryPath', () => {
  it('uses the actual Bun global bin directory reported by bun pm bin -g', () => {
    expect(
      resolveBunGlobalBinaryPath({
        binaryName: 'qtx',
        fallbackBinDir: '/tmp/quantex/home/.bun/bin',
        pmBinOutput: '/usr/local/bin\n',
      }),
    ).toBe('/usr/local/bin/qtx')
  })

  it('falls back to the isolated BUN_INSTALL bin directory when Bun reports no bin path', () => {
    expect(
      resolveBunGlobalBinaryPath({
        binaryName: 'qtx',
        fallbackBinDir: '/tmp/quantex/home/.bun/bin',
        pmBinOutput: '\n',
      }),
    ).toBe('/tmp/quantex/home/.bun/bin/qtx')
  })

  it('preserves Windows-style Bun bin directories', () => {
    expect(
      resolveBunGlobalBinaryPath({
        binaryName: 'qtx',
        fallbackBinDir: 'C:\\Users\\runner\\.bun\\bin',
        pmBinOutput: 'C:\\Program Files\\Bun\\bin\n',
      }),
    ).toBe('C:\\Program Files\\Bun\\bin\\qtx')
  })
})
