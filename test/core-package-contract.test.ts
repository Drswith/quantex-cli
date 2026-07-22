import { describe, expect, it } from 'vitest'
import {
  assertCorePackageManifestContract,
  type CorePackageManifest,
  type RootPackageManifest,
} from '../scripts/verify-core-package-distribution'

const rootManifest: RootPackageManifest = {
  devDependencies: { '@quantex/core': '1.1.3' },
  version: '1.1.3',
  workspaces: ['packages/core'],
}

const coreManifest: CorePackageManifest = {
  engines: { node: '>=20' },
  exports: {
    '.': {
      import: './dist/index.mjs',
      types: './dist/index.d.mts',
    },
    './package.json': './package.json',
  },
  name: '@quantex/core',
  version: '1.1.3',
}

describe('Core package manifest contract', () => {
  it('accepts one same-version Core workspace with no runtime coupling', () => {
    expect(() => assertCorePackageManifestContract(rootManifest, coreManifest)).not.toThrow()
  })

  it('rejects version drift and a non-exact root development dependency', () => {
    expect(() =>
      assertCorePackageManifestContract(
        {
          ...rootManifest,
          devDependencies: { '@quantex/core': '^1.1.3' },
        },
        {
          ...coreManifest,
          version: '1.1.4',
        },
      ),
    ).toThrow(/versions must match exactly[\s\S]*must pin @quantex\/core exactly/)
  })

  it('rejects runtime Core installation, extra public subpaths, and workspace protocols', () => {
    expect(() =>
      assertCorePackageManifestContract(
        {
          ...rootManifest,
          dependencies: { '@quantex/core': 'workspace:*' },
        },
        {
          ...coreManifest,
          exports: {
            ...coreManifest.exports,
            './internal': './dist/internal.mjs',
          },
        },
      ),
    ).toThrow(/inline Core[\s\S]*expose only[\s\S]*workspace:/)
  })

  it('rejects Core runtime dependencies so the packed SDK stays self-contained', () => {
    expect(() =>
      assertCorePackageManifestContract(rootManifest, {
        ...coreManifest,
        dependencies: { zod: '^4.3.6' },
      }),
    ).toThrow(/self-contained, found zod/)
  })
})
