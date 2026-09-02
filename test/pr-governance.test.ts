import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { requiredPrBodyHeadings, validatePrBodyPolicy } from '../scripts/ci/pr-body-policy'

const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const prTemplate = readFileSync('.github/pull_request_template.md', 'utf8')
const prBodyPolicyScript = readFileSync('scripts/ci/pr-body-policy.ts', 'utf8')
const commitPolicyScript = readFileSync('scripts/ci/commit-policy.ts', 'utf8')
const collaborationGuide = readFileSync('docs/github-collaboration.md', 'utf8')
const openspecReadme = readFileSync('openspec/README.md', 'utf8')
const runtimeSkill = readFileSync('skills/quantex-agent-runtime/SKILL.md', 'utf8')
const integrationRunbookPath = 'docs/runbooks/lifecycle-integration-delivery.md'

function extractNamedStep(workflow: string, stepName: string): string {
  const marker = `      - name: ${stepName}\n`
  const startIndex = workflow.indexOf(marker)
  if (startIndex === -1) throw new Error(`Missing workflow step: ${stepName}`)

  const remainingWorkflow = workflow.slice(startIndex + marker.length)
  const nextStepIndex = remainingWorkflow.indexOf('\n      - ')
  const endIndex = nextStepIndex === -1 ? workflow.length : startIndex + marker.length + nextStepIndex

  return workflow.slice(startIndex, endIndex)
}

describe('pr governance release intent', () => {
  it('requires a release intent section in PR bodies', () => {
    expect(ciWorkflow).toContain('bun run pr:body:check')
    expect(prBodyPolicyScript).toContain("'## Release Intent'")
    expect(prTemplate).toContain('## Release Intent')
  })

  it('requires a release-summary section in PR bodies', () => {
    expect(prBodyPolicyScript).toContain("'## Release Summary'")
    expect(prTemplate).toContain('## Release Summary')
  })

  it('guards product-impacting files from silently skipping release automation', () => {
    expect(ciWorkflow).toContain('bun run pr:body:check')
    expect(ciWorkflow).toContain('PR_BODY')
    expect(ciWorkflow).toContain('PR_HEAD_BRANCH')
    expect(ciWorkflow).toContain('PR_TITLE')
    expect(ciWorkflow).toContain('bun run ci:path-taxonomy')
  })

  it('keeps release-please PR bodies compatible with required governance headings', () => {
    for (const fileName of ['release-please-config.json']) {
      const config = JSON.parse(readFileSync(fileName, 'utf8')) as {
        packages: {
          '.': {
            'changelog-types'?: Array<{ hidden?: boolean; section?: string; type?: string }>
            'pull-request-header': string
          }
        }
      }
      const header = config.packages['.']['pull-request-header']

      expect(header).toContain('## Release Intent')
      expect(header).toContain('## Release Summary')
      expect(header).toContain('## Closure Check')
      expect(config.packages['.']['changelog-types']).toContainEqual({
        hidden: false,
        section: 'Internal Improvements',
        type: 'refactor',
      })
    }
  })

  it('keeps stable release-please graduated without a persistent release override', () => {
    const config = JSON.parse(readFileSync('release-please-config.json', 'utf8')) as {
      packages: {
        '.': {
          'bump-minor-pre-major'?: boolean
          'release-as'?: string
        }
      }
    }

    expect(config.packages['.']['bump-minor-pre-major']).toBe(false)
    expect(config.packages['.']['release-as']).toBeUndefined()
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
    expect(runtimeSkill).toContain('milestone merge is not archive eligibility')
    expect(prTemplate).toContain('active across milestone merges by design')
  })

  it('runs PR commit governance before merge on human PRs', () => {
    expect(ciWorkflow).toContain('Validate PR commit policy')
    expect(ciWorkflow).toContain('bun run ci:commit-policy')
    expect(ciWorkflow).toContain('PR_COMMITS_JSON')
    expect(commitPolicyScript).toContain('Release-As')
  })

  it('keeps release-please PRs on dedicated release validation without human heuristics', () => {
    expect(ciWorkflow).toContain('Validate release PR policy')
    expect(ciWorkflow).toContain('bun run ci:release-pr-policy')
    expect(ciWorkflow).toContain('PR_BASE_VERSION')

    const bodyStep = extractNamedStep(ciWorkflow, 'Validate PR body')
    const commitStep = extractNamedStep(ciWorkflow, 'Validate PR commit policy')
    const releaseStep = extractNamedStep(ciWorkflow, 'Validate release PR policy')
    const skipHumanHeuristics = "!startsWith(github.event.pull_request.head.ref, 'release-please--branches--')"
    const onlyReleasePlease = "startsWith(github.event.pull_request.head.ref, 'release-please--branches--')"

    expect(bodyStep).toContain(`if: "${skipHumanHeuristics}"`)
    expect(commitStep).toContain(`if: "${skipHumanHeuristics}"`)
    expect(releaseStep).toContain(`if: ${onlyReleasePlease}`)
    expect(ciWorkflow).not.toContain('PR_IS_VALIDATED_RELEASE_PR')
  })
})

// Contributors are told to write PR bodies based on the shipped template, and
// GitHub pre-populates it into every pull request. If the template cannot pass
// the policy that guards it, following the documented process still fails CI.
describe('pr template satisfies pr body governance', () => {
  it('carries every heading the policy requires', () => {
    for (const heading of requiredPrBodyHeadings) {
      expect(prTemplate).toContain(heading)
    }
  })

  it('passes the policy unmodified', () => {
    expect(validatePrBodyPolicy({ body: prTemplate, title: 'chore: some change' })).toEqual([])
  })

  it('keeps generated release-please headers passing the same policy', () => {
    for (const fileName of ['release-please-config.json']) {
      const config = JSON.parse(readFileSync(fileName, 'utf8')) as {
        packages: { '.': { 'pull-request-header': string } }
      }

      expect(
        validatePrBodyPolicy({
          body: config.packages['.']['pull-request-header'],
          title: 'chore: release 1.2.3',
        }),
      ).toEqual([])
    }
  })
})
