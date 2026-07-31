import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const prGovernanceWorkflow = readFileSync('.github/workflows/pr-governance.yml', 'utf8')
const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8')
const sandboxWorkflow = readFileSync('.github/workflows/sandbox-tests.yml', 'utf8')
const integrationBranchPattern = "'codex/simplify-core-sdk-*'"

function extractEventBlock(workflow: string, eventName: string): string {
  const lines = workflow.split(/\r?\n/)
  const startIndex = lines.findIndex(line => line === `  ${eventName}:`)

  if (startIndex === -1) throw new Error(`Missing ${eventName} event block.`)

  const nextBoundaryOffset = lines.slice(startIndex + 1).findIndex(line => /^(?:  [\w-]+|[\w-]+):/.test(line))
  const endIndex = nextBoundaryOffset === -1 ? lines.length : startIndex + 1 + nextBoundaryOffset

  return lines.slice(startIndex, endIndex).join('\n')
}

function extractYamlList(block: string, key: string): string[] {
  const lines = block.split(/\r?\n/)
  const keyIndex = lines.findIndex(line => line.trim() === `${key}:`)

  if (keyIndex === -1) throw new Error(`Missing ${key} list.`)

  const keyIndent = lines[keyIndex]?.search(/\S/) ?? 0
  const values: string[] = []

  for (const line of lines.slice(keyIndex + 1)) {
    if (line.trim() === '') continue

    const indent = line.search(/\S/)
    if (indent <= keyIndent) break
    if (indent === keyIndent + 2 && line.trim().startsWith('- ')) values.push(line.trim().slice(2))
  }

  return values
}

function extractTopLevelJobIds(workflow: string): string[] {
  const jobsBlock = workflow.split('\njobs:\n')[1]
  if (!jobsBlock) throw new Error('Missing jobs block.')

  return [...jobsBlock.matchAll(/^  ([\w-]+):\n/gm)].map(match => match[1] as string)
}

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
      'QTX_ISOLATION_SCENARIOS=managed,deno-managed,uv-managed,adopt-preinstalled,ambiguous-multi-method,self-binary',
    )
    expect(sandboxWorkflow).not.toContain("'src/self/**'")
  })

  it.each([
    ['PR Governance', prGovernanceWorkflow, 'pull_request'],
    ['Release', releaseWorkflow, 'workflow_dispatch'],
  ])('isolates the terminal %s %s event from following top-level keys', (_, workflow, eventName) => {
    expect(extractEventBlock(workflow, eventName)).not.toMatch(/^(?:permissions|jobs):/m)
  })

  it('runs CI for integration-branch pushes without widening pull-request base targets', () => {
    expect(extractYamlList(extractEventBlock(ciWorkflow, 'pull_request'), 'branches')).toEqual(['main', 'beta'])
    expect(extractYamlList(extractEventBlock(ciWorkflow, 'push'), 'branches')).toEqual([
      'main',
      'beta',
      integrationBranchPattern,
    ])
  })

  it('runs Sandbox Tests for integration-branch pushes without widening pull-request base targets', () => {
    expect(extractYamlList(extractEventBlock(sandboxWorkflow, 'pull_request'), 'branches')).toEqual(['main', 'beta'])
    expect(extractYamlList(extractEventBlock(sandboxWorkflow, 'push'), 'branches')).toEqual([
      'main',
      'beta',
      integrationBranchPattern,
    ])
  })

  it('uses Node 20 package consumers and includes workspace manifests in CI cache keys', () => {
    expect(ciWorkflow).toContain('node-version: 20')
    expect(ciWorkflow).toContain("hashFiles('bun.lock', 'package.json', 'packages/*/package.json')")
    expect(sandboxWorkflow).toContain("hashFiles('bun.lock', 'package.json', 'packages/*/package.json')")
    expect(ciWorkflow).toContain("runner.os == 'Linux' }}\n        run: bun run package:check")
  })

  it('skips full Windows tests only for product-impacting pull requests', () => {
    expect(ciWorkflow).toContain(
      "needs.classify.outputs.run_test_matrix == 'true' && runner.os == 'Windows' && github.event_name != 'pull_request' }}\n        run: bun run test -- --pool=threads",
    )
    expect(ciWorkflow).toContain("github.event_name != 'pull_request'")
  })

  it('preserves the six live merge-gate contexts', () => {
    const ciJobIds = extractTopLevelJobIds(ciWorkflow)
    const sandboxJobIds = extractTopLevelJobIds(sandboxWorkflow)
    const governanceJobIds = extractTopLevelJobIds(prGovernanceWorkflow)
    const platformList = ciWorkflow.match(/^\s+os: \[(?<platforms>[^\]]+)\]$/m)?.groups?.platforms

    if (!platformList) throw new Error('Missing CI test platform matrix.')

    const requiredContexts = [
      ...ciJobIds.filter(jobId => jobId !== 'test'),
      ...platformList.split(',').map(platform => `test (${platform.trim()})`),
      ...sandboxJobIds.filter(jobId => jobId === 'sandbox-tests'),
    ]

    expect(requiredContexts).toEqual([
      'classify',
      'lint',
      'test (ubuntu-latest)',
      'test (windows-latest)',
      'test (macos-latest)',
      'sandbox-tests',
    ])
    expect(governanceJobIds).toContain('validate-body')
    expect(requiredContexts).not.toContain('validate-body')
  })

  it('keeps PR Governance on its unfiltered all-pull-request trigger', () => {
    const pullRequestBlock = extractEventBlock(prGovernanceWorkflow, 'pull_request')

    expect(pullRequestBlock).not.toMatch(/^\s+branches:/m)
    expect(extractYamlList(pullRequestBlock, 'types')).toEqual(['opened', 'edited', 'reopened', 'synchronize'])
  })

  it('keeps release dispatch explicit and isolated from integration branches', () => {
    const workflowDispatchBlock = extractEventBlock(releaseWorkflow, 'workflow_dispatch')

    expect(extractYamlList(workflowDispatchBlock, 'options')).toEqual(['main', 'beta'])
    expect(workflowDispatchBlock).not.toContain(integrationBranchPattern)
    expect(releaseWorkflow).not.toContain(integrationBranchPattern)
    expect(releaseWorkflow).toContain('- name: Resolve release target')
    expect(releaseWorkflow).toContain('echo "npm_tag=beta"')
    expect(releaseWorkflow).toContain('echo "npm_tag=latest"')
  })
})
