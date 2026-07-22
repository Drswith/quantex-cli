import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const prGovernanceWorkflow = readFileSync('.github/workflows/pr-governance.yml', 'utf8')
const releaseAutomergeWorkflow = readFileSync('.github/workflows/release-pr-automerge.yml', 'utf8')
const releaseVerifyWorkflow = readFileSync('.github/workflows/release-verify.yml', 'utf8')
const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8')
const sandboxWorkflow = readFileSync('.github/workflows/sandbox-tests.yml', 'utf8')
const integrationBranch = 'codex/simplify-core-sdk-integration'

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
      integrationBranch,
    ])
  })

  it('runs Sandbox Tests for integration-branch pushes without widening pull-request base targets', () => {
    expect(extractYamlList(extractEventBlock(sandboxWorkflow, 'pull_request'), 'branches')).toEqual(['main', 'beta'])
    expect(extractYamlList(extractEventBlock(sandboxWorkflow, 'push'), 'branches')).toEqual([
      'main',
      'beta',
      integrationBranch,
    ])
  })

  it('runs full release verification for integration-branch pushes', () => {
    expect(extractYamlList(extractEventBlock(releaseVerifyWorkflow, 'push'), 'branches')).toEqual([integrationBranch])
    expect(releaseVerifyWorkflow).toContain('run: bun run package:check')
  })

  it('uses Node 20 package consumers and includes workspace manifests in CI cache keys', () => {
    expect(ciWorkflow).toContain('node-version: 20')
    expect(ciWorkflow).toContain("hashFiles('bun.lock', 'package.json', 'packages/*/package.json')")
    expect(sandboxWorkflow).toContain("hashFiles('bun.lock', 'package.json', 'packages/*/package.json')")
    expect(ciWorkflow).toContain("runner.os == 'Linux' }}\n        run: bun run package:check")
  })

  it('runs the real Windows test command for every product-impacting matrix event', () => {
    expect(ciWorkflow).toContain(
      "needs.classify.outputs.run_test_matrix == 'true' && runner.os == 'Windows' }}\n        run: bun run test -- --pool=threads",
    )
    expect(ciWorkflow).not.toContain("runner.os == 'Windows' && github.event_name != 'pull_request'")
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

  it('blocks integration at release event gates before resolver and npm channel selection', () => {
    const workflowRunBlock = extractEventBlock(releaseWorkflow, 'workflow_run')
    const workflowDispatchBlock = extractEventBlock(releaseWorkflow, 'workflow_dispatch')
    const releasePrBlock = extractEventBlock(releaseAutomergeWorkflow, 'pull_request_target')

    expect(extractYamlList(workflowRunBlock, 'branches')).toEqual(['main', 'beta'])
    expect(extractYamlList(workflowDispatchBlock, 'options')).toEqual(['main', 'beta'])
    expect(extractYamlList(releasePrBlock, 'branches')).toEqual(['main', 'beta'])
    expect(workflowRunBlock).not.toContain(integrationBranch)
    expect(workflowDispatchBlock).not.toContain(integrationBranch)
    expect(releasePrBlock).not.toContain(integrationBranch)
    expect(releaseWorkflow).not.toContain(integrationBranch)
    expect(releaseAutomergeWorkflow).not.toContain(integrationBranch)
    expect(releaseWorkflow).toContain('- name: Resolve release target')
    expect(releaseWorkflow).toContain('echo "npm_tag=beta"')
    expect(releaseWorkflow).toContain('echo "npm_tag=latest"')
  })

  it('validates Release PR versions from immutable base and head manifests', () => {
    expect(releaseAutomergeWorkflow).toContain("readJsonFile('package.json', pullRequest.base.sha)")
    expect(releaseAutomergeWorkflow).toContain("readJsonFile('package.json', pullRequest.head.sha)")
    expect(releaseAutomergeWorkflow).toContain("readJsonFile('packages/core/package.json', pullRequest.head.sha)")
    expect(releaseAutomergeWorkflow).toContain('coreManifest: headCorePackageJson')
    expect(releaseAutomergeWorkflow).toContain('rootManifest: headPackageJson')
    expect(releaseAutomergeWorkflow).not.toContain('ref: baseBranch')
  })

  it('keeps the exact 1.1.0 graduation Release PR on manual rebase-first delivery', () => {
    expect(releaseAutomergeWorkflow).toContain('id: validate-release-pr')
    expect(releaseAutomergeWorkflow).toContain("basePackageJson.version === '0.29.1'")
    expect(releaseAutomergeWorkflow).toContain("title === 'chore: release 1.1.0'")
    expect(releaseAutomergeWorkflow).toContain(
      "core.setOutput('manual_merge_required', manualMergeRequired ? 'true' : 'false')",
    )
    expect(
      releaseAutomergeWorkflow.match(/if: steps\.validate-release-pr\.outputs\.manual_merge_required != 'true'/g),
    ).toHaveLength(2)
  })
})
