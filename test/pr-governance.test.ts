import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const prGovernanceWorkflow = readFileSync('.github/workflows/pr-governance.yml', 'utf8')
const prTemplate = readFileSync('.github/pull_request_template.md', 'utf8')
const prBodyPolicyScript = readFileSync('scripts/pr-body-policy.ts', 'utf8')
const prMergeCommitPolicyScript = readFileSync('scripts/pr-merge-commit-policy.ts', 'utf8')
const collaborationGuide = readFileSync('docs/github-collaboration.md', 'utf8')
const openspecReadme = readFileSync('openspec/README.md', 'utf8')
const runtimeSkill = readFileSync('skills/quantex-agent-runtime/SKILL.md', 'utf8')
const integrationRunbookPath = 'docs/runbooks/lifecycle-integration-delivery.md'

describe('pr governance release intent', () => {
  it('requires a release intent section in PR bodies', () => {
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

  it('keeps stable release-please on the zero-major line for pre-1.0 breaking changes', () => {
    const config = JSON.parse(readFileSync('release-please-config.json', 'utf8')) as {
      packages: {
        '.': {
          'bump-minor-pre-major'?: boolean
        }
      }
    }

    expect(config.packages['.']['bump-minor-pre-major']).toBe(true)
  })

  it('keeps PR template compatible with agent-driven OpenSpec archive closure', () => {
    expect(prTemplate).toContain('## Closure Check')
    expect(prTemplate).toContain('queued for agent-driven archive closure')
  })

  it('removes temporary lifecycle integration runtime guidance after promotion', () => {
    expect(existsSync(integrationRunbookPath)).toBe(false)
    expect(runtimeSkill).not.toContain('docs/runbooks/lifecycle-integration-delivery.md')
    expect(collaborationGuide).not.toContain('Lifecycle Integration Delivery')
  })

  it('keeps generic umbrella archive timing after temporary runtime removal', () => {
    expect(runtimeSkill).toContain('active umbrella change')
    expect(openspecReadme).toContain('milestone merge is not archive eligibility')
    expect(prTemplate).toContain('active across milestone merges by design')
  })

  it('runs commit trailer governance from CI through a local repository script', () => {
    expect(ciWorkflow).toContain('Validate commit trailer policy')
    expect(ciWorkflow).toContain('bun run scripts/commit-trailer-policy.ts')
    expect(ciWorkflow).toContain('List commits for trailer policy')
  })

  it('runs PR merge commit governance before merge', () => {
    expect(prGovernanceWorkflow).toContain('Validate PR merge commit policy')
    expect(prGovernanceWorkflow).toContain('bun run scripts/pr-merge-commit-policy.ts')
    expect(prGovernanceWorkflow).toContain('PR_COMMITS_JSON')
    expect(prGovernanceWorkflow).toContain('PR_IS_VALIDATED_RELEASE_PR')
    expect(prMergeCommitPolicyScript).toContain('GitHub squash merge')
  })

  it('validates release-please PRs before granting release-specific exemptions', () => {
    expect(prGovernanceWorkflow).toContain('Validate release PR policy')
    expect(prGovernanceWorkflow).toContain('bun run scripts/release-pr-policy.js')
    expect(prGovernanceWorkflow).toContain('PR_BASE_VERSION')
  })
})
