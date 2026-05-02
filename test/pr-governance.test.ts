import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const prGovernanceWorkflow = readFileSync('.github/workflows/pr-governance.yml', 'utf8')
const prTemplate = readFileSync('.github/pull_request_template.md', 'utf8')
const prBodyPolicyScript = readFileSync('scripts/pr-body-policy.ts', 'utf8')

describe('pr governance release intent', () => {
  it('requires a release intent section in PR bodies', () => {
    expect(prGovernanceWorkflow).toContain('bun run scripts/merge-pr-body-for-governance.ts')
    expect(prGovernanceWorkflow).toContain('bun run pr:body:check')
    expect(prBodyPolicyScript).toContain("'## Release Intent'")
    expect(prTemplate).toContain('## Release Intent')
  })

  it('guards product-impacting files from silently skipping release automation', () => {
    expect(prGovernanceWorkflow).toContain('bun run pr:body:check')
    expect(prGovernanceWorkflow).toContain('PR_BODY')
    expect(prGovernanceWorkflow).toContain('PR_HEAD_BRANCH')
    expect(prGovernanceWorkflow).toContain('PR_TITLE')
    expect(prGovernanceWorkflow).toContain('bun run scripts/path-taxonomy.ts')
  })

  it('keeps release-please PR bodies compatible with required governance headings', () => {
    for (const fileName of ['release-please-config.json', 'release-please-config.beta.json']) {
      const config = JSON.parse(readFileSync(fileName, 'utf8')) as {
        packages: {
          '.': {
            'pull-request-header': string
          }
        }
      }
      const header = config.packages['.']['pull-request-header']

      expect(header).toContain('## Release Intent')
      expect(header).toContain('## Closure Check')
    }
  })

  it('keeps PR template compatible with agent-driven OpenSpec archive closure', () => {
    expect(prTemplate).toContain('## Closure Check')
    expect(prTemplate).toContain('queued for agent-driven archive closure')
  })
})
