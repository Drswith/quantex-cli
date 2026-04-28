import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const prGovernanceWorkflow = readFileSync('.github/workflows/pr-governance.yml', 'utf8')
const prTemplate = readFileSync('.github/pull_request_template.md', 'utf8')

describe('pr governance release intent', () => {
  it('requires a release intent section in PR bodies', () => {
    expect(prGovernanceWorkflow).toContain('\'## Release Intent\'')
    expect(prTemplate).toContain('## Release Intent')
  })

  it('guards product-impacting files from silently skipping release automation', () => {
    expect(prGovernanceWorkflow).toContain('Validate product release intent')
    expect(prGovernanceWorkflow).toContain('headBranch.startsWith(\'release-please--branches--\')')
    expect(prGovernanceWorkflow).toContain('fileName.startsWith(\'src/\')')
    expect(prGovernanceWorkflow).toContain('fileName.startsWith(\'skills/quantex-cli/\')')
    expect(prGovernanceWorkflow).toContain('Release: not applicable - <reason>')
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
})
