import { describe, expect, it } from 'vitest'
import { classifyChangedFiles, isProcessOnlyPath, isProductImpactingPath } from '../scripts/path-taxonomy'

describe('path taxonomy', () => {
  it('classifies process-only changes from docs and workflow paths', () => {
    expect(classifyChangedFiles(['.github/workflows/ci.yml', 'openspec/specs/code-quality-tooling/spec.md'])).toEqual({
      changedFiles: ['.github/workflows/ci.yml', 'openspec/specs/code-quality-tooling/spec.md'],
      processOnly: true,
      productImpacting: false,
      productImpactingFiles: [],
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
      runTestMatrix: true,
      scope: 'unknown',
    })
  })

  it('exposes stable product-impacting and process-only predicates', () => {
    expect(isProductImpactingPath('scripts/path-taxonomy.ts')).toBe(true)
    expect(isProductImpactingPath('docs/README.md')).toBe(false)
    expect(isProcessOnlyPath('.github/workflows/ci.yml')).toBe(true)
    expect(isProcessOnlyPath('src/index.ts')).toBe(false)
  })
})
