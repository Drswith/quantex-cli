import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const prGovernanceWorkflow = readFileSync('.github/workflows/pr-governance.yml', 'utf8')
const sandboxWorkflow = readFileSync('.github/workflows/sandbox-tests.yml', 'utf8')

describe('workflow classification integration', () => {
  it('routes CI scope classification through the shared taxonomy script', () => {
    expect(ciWorkflow).toContain('bun run scripts/path-taxonomy.ts')
    expect(ciWorkflow).toContain('CHANGED_FILES_JSON')
    expect(ciWorkflow).not.toContain('const productImpactingPrefixes = [')
  })

  it('routes PR governance scope classification through the shared taxonomy script', () => {
    expect(prGovernanceWorkflow).toContain('bun run scripts/path-taxonomy.ts')
    expect(prGovernanceWorkflow).toContain('bun run pr:body:check')
    expect(prGovernanceWorkflow).not.toContain("fileName.startsWith('src/')")
  })

  it('routes sandbox workflow classification through the shared taxonomy script', () => {
    expect(sandboxWorkflow).toContain('bun run scripts/path-taxonomy.ts')
    expect(sandboxWorkflow).toContain('sandbox_relevant')
    expect(sandboxWorkflow).toContain(
      'QTX_ISOLATION_SCENARIOS=managed,uv-managed,adopt-preinstalled,ambiguous-multi-method,self-binary',
    )
    expect(sandboxWorkflow).not.toContain("'src/self/**'")
  })
})
