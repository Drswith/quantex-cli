import { describe, expect, it } from 'vitest'
import {
  classifyChangedFiles,
  isProcessOnlyPath,
  isProductImpactingPath,
  isSandboxRelevantPath,
} from '../scripts/path-taxonomy'

describe('path taxonomy', () => {
  it('classifies process-only changes from docs and workflow paths', () => {
    expect(classifyChangedFiles(['.github/workflows/ci.yml', 'openspec/specs/code-quality-tooling/spec.md'])).toEqual({
      changedFiles: ['.github/workflows/ci.yml', 'openspec/specs/code-quality-tooling/spec.md'],
      processOnly: true,
      productImpacting: false,
      productImpactingFiles: [],
      sandboxRelevant: false,
      sandboxRelevantFiles: [],
      runTestMatrix: false,
      scope: 'process-only',
    })
  })

  it('classifies product-impacting changes when any product file is present', () => {
    expect(classifyChangedFiles(['docs/github-collaboration.md', 'src/cli.ts'])).toEqual({
      changedFiles: ['docs/github-collaboration.md', 'src/cli.ts'],
      processOnly: false,
      productImpacting: true,
      productImpactingFiles: ['src/cli.ts'],
      sandboxRelevant: false,
      sandboxRelevantFiles: [],
      runTestMatrix: true,
      scope: 'product-impacting',
    })
  })

  it('classifies uncategorized files as mixed', () => {
    expect(classifyChangedFiles(['.vscode/settings.json'])).toEqual({
      changedFiles: ['.vscode/settings.json'],
      processOnly: false,
      productImpacting: false,
      productImpactingFiles: [],
      sandboxRelevant: false,
      sandboxRelevantFiles: [],
      runTestMatrix: true,
      scope: 'mixed',
    })
  })

  it('defaults to unknown scope when no changed-file diff is available', () => {
    expect(classifyChangedFiles(undefined)).toEqual({
      changedFiles: [],
      processOnly: false,
      productImpacting: false,
      productImpactingFiles: [],
      sandboxRelevant: true,
      sandboxRelevantFiles: [],
      runTestMatrix: true,
      scope: 'unknown',
    })
  })

  it('marks lifecycle-sensitive files as sandbox-relevant', () => {
    expect(classifyChangedFiles(['src/self/index.ts', 'docs/github-collaboration.md'])).toEqual({
      changedFiles: ['src/self/index.ts', 'docs/github-collaboration.md'],
      processOnly: false,
      productImpacting: true,
      productImpactingFiles: ['src/self/index.ts'],
      sandboxRelevant: true,
      sandboxRelevantFiles: ['src/self/index.ts'],
      runTestMatrix: true,
      scope: 'product-impacting',
    })
  })

  it('treats Core package sources as product-impacting and sandbox-relevant', () => {
    expect(classifyChangedFiles(['packages/core/src/index.ts'])).toEqual({
      changedFiles: ['packages/core/src/index.ts'],
      processOnly: false,
      productImpacting: true,
      productImpactingFiles: ['packages/core/src/index.ts'],
      sandboxRelevant: true,
      sandboxRelevantFiles: ['packages/core/src/index.ts'],
      runTestMatrix: true,
      scope: 'product-impacting',
    })
  })

  it('treats Core package manifests and build configuration as product-impacting', () => {
    const classification = classifyChangedFiles(['packages/core/package.json', 'packages/core/tsdown.config.ts'])

    expect(classification.productImpacting).toBe(true)
    expect(classification.productImpactingFiles).toEqual([
      'packages/core/package.json',
      'packages/core/tsdown.config.ts',
    ])
    expect(classification.runTestMatrix).toBe(true)
  })

  it('exposes stable product-impacting and process-only predicates', () => {
    expect(isProductImpactingPath('scripts/path-taxonomy.ts')).toBe(true)
    expect(isProductImpactingPath('docs/README.md')).toBe(false)
    expect(isProcessOnlyPath('.github/workflows/ci.yml')).toBe(true)
    expect(isProcessOnlyPath('src/index.ts')).toBe(false)
    expect(isSandboxRelevantPath('.github/workflows/sandbox-tests.yml')).toBe(true)
    expect(isSandboxRelevantPath('scripts/deno-lifecycle-smoke.ts')).toBe(true)
    expect(isSandboxRelevantPath('scripts/uv-lifecycle-smoke.ts')).toBe(true)
    expect(isProductImpactingPath('packages/core/src/client.ts')).toBe(true)
    expect(isSandboxRelevantPath('packages/core/src/client.ts')).toBe(true)
    expect(isSandboxRelevantPath('.github/workflows/ci.yml')).toBe(false)
  })
})
