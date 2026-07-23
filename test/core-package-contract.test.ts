import { describe, expect, it } from 'vitest'
import {
  assertCorePackageFileContract,
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

const corePublicFiles = ['LICENSE', 'README.md', 'dist/index.d.mts', 'package.json'] as const

function packedFilesFor(runtimeModules: ReadonlyMap<string, string>): readonly string[] {
  return [...corePublicFiles, ...runtimeModules.keys()]
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

describe('Core package runtime file contract', () => {
  it('accepts only the recursive static and dynamic runtime import closure', () => {
    const runtimeModules = new Map([
      ['dist/index.mjs', "import './read-A1b2.mjs'; export const loadMutation = () => import('./mutation-C3d4.mjs')"],
      ['dist/read-A1b2.mjs', "import { join } from 'node:path'; export { join }"],
      ['dist/mutation-C3d4.mjs', "export { mutate } from './shared-E5f6.mjs'"],
      ['dist/shared-E5f6.mjs', 'export const mutate = () => undefined'],
    ])

    expect(assertCorePackageFileContract(packedFilesFor(runtimeModules), runtimeModules)).toEqual(
      [...corePublicFiles, ...runtimeModules.keys()].sort(),
    )
  })

  it('rejects an orphan runtime chunk even when its filename resembles tsdown output', () => {
    const runtimeModules = new Map([
      ['dist/index.mjs', "export const loadMutation = () => import('./mutation-A1b2.mjs')"],
      ['dist/mutation-A1b2.mjs', 'export const mutate = () => undefined'],
      ['dist/orphan-C3d4.mjs', 'export const orphan = true'],
    ])

    expect(() => assertCorePackageFileContract(packedFilesFor(runtimeModules), runtimeModules)).toThrow(
      /only the public runtime import closure[\s\S]*orphan-C3d4\.mjs/,
    )
  })

  it('scans every emitted runtime chunk for forbidden package-boundary code', () => {
    const runtimeModules = new Map([
      ['dist/index.mjs', "export const loadMutation = () => import('./mutation-A1b2.mjs')"],
      ['dist/mutation-A1b2.mjs', "export const presentationDependency = 'picocolors'"],
    ])

    expect(() => assertCorePackageFileContract(packedFilesFor(runtimeModules), runtimeModules)).toThrow(
      /mutation-A1b2\.mjs crosses a package boundary: CLI or presentation: picocolors/,
    )
  })

  it('allows the mutation runner only behind a dynamic boundary, never in the eager root', () => {
    const lazyMutation = new Map([
      ['dist/index.mjs', "export const mutate = () => import('./mutation-A1b2.mjs')"],
      ['dist/mutation-A1b2.mjs', 'export const run = runPackageMutationOutcome'],
    ])
    expect(() => assertCorePackageFileContract(packedFilesFor(lazyMutation), lazyMutation)).not.toThrow()

    const eagerMutation = new Map([['dist/index.mjs', 'export const run = runPackageMutationOutcome']])
    expect(() => assertCorePackageFileContract(packedFilesFor(eagerMutation), eagerMutation)).toThrow(
      /eager read-only runtime module dist\/index\.mjs contains mutation-only infrastructure: runPackageMutationOutcome/,
    )
  })

  it('applies the 80KB budget to the root entry without imposing it on reachable chunks', () => {
    const runtimeModules = new Map([
      ['dist/index.mjs', `/* ${'x'.repeat(80_001)} */`],
      ['dist/mutation-A1b2.mjs', `export const data = '${'x'.repeat(80_001)}'`],
    ])

    expect(() =>
      assertCorePackageFileContract(
        packedFilesFor(new Map([['dist/index.mjs', runtimeModules.get('dist/index.mjs') ?? '']])),
        new Map([['dist/index.mjs', runtimeModules.get('dist/index.mjs') ?? '']]),
      ),
    ).toThrow(/runtime entry exceeds the 80000-byte lightweight budget/)

    const rootWithLargeReachableChunk = new Map([
      ['dist/index.mjs', "export const loadMutation = () => import('./mutation-A1b2.mjs')"],
      ['dist/mutation-A1b2.mjs', runtimeModules.get('dist/mutation-A1b2.mjs') ?? ''],
    ])
    expect(() =>
      assertCorePackageFileContract(packedFilesFor(rootWithLargeReachableChunk), rootWithLargeReachableChunk),
    ).not.toThrow()
  })
})
