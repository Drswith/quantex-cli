import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const releasePleaseWorkflow = readFileSync('.github/workflows/release-please.yml', 'utf8')
const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8')
const sandboxWorkflow = readFileSync('.github/workflows/sandbox-tests.yml', 'utf8')

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

describe('workflow classification integration', () => {
  it('routes CI scope classification through the shared taxonomy script', () => {
    expect(ciWorkflow).toContain('bun run ci:path-taxonomy')
    expect(ciWorkflow).toContain('CHANGED_FILES_JSON')
    expect(ciWorkflow).not.toContain('const productImpactingPrefixes = [')
  })

  it('routes governance scope classification through the shared taxonomy script', () => {
    expect(ciWorkflow).toContain('governance:')
    expect(ciWorkflow).toContain('bun run pr:body:check')
    expect(ciWorkflow).not.toContain("fileName.startsWith('src/')")
  })

  it('routes sandbox workflow classification through the shared taxonomy script', () => {
    expect(sandboxWorkflow).toContain('bun run ci:path-taxonomy')
    expect(sandboxWorkflow).toContain('sandbox_relevant')
    expect(sandboxWorkflow).toContain(
      'QTX_ISOLATION_SCENARIOS=managed,deno-managed,uv-managed,adopt-preinstalled,ambiguous-multi-method,self-binary',
    )
    expect(sandboxWorkflow).not.toContain("'src/self/**'")
  })

  it('runs CI and sandbox only for main and beta', () => {
    expect(extractYamlList(extractEventBlock(ciWorkflow, 'pull_request'), 'branches')).toEqual(['main', 'beta'])
    expect(extractYamlList(extractEventBlock(ciWorkflow, 'push'), 'branches')).toEqual(['main', 'beta'])
    expect(extractYamlList(extractEventBlock(sandboxWorkflow, 'pull_request'), 'branches')).toEqual(['main', 'beta'])
    expect(extractYamlList(extractEventBlock(sandboxWorkflow, 'push'), 'branches')).toEqual(['main', 'beta'])
  })

  it('uses Node 24 in test jobs and includes workspace manifests in cache keys', () => {
    const setupBunAction = readFileSync('.github/actions/setup-bun/action.yml', 'utf8')

    expect(ciWorkflow).toContain('node-version: 24')
    expect(setupBunAction).toContain("hashFiles('bun.lock', 'package.json', 'packages/*/package.json')")
    expect(sandboxWorkflow).toContain('./.github/actions/setup-bun')
    expect(ciWorkflow).toContain('bun run package:check')
  })

  it('skips Windows test job for pull requests', () => {
    expect(ciWorkflow).toContain('name: test (windows-latest)')
    expect(ciWorkflow).toContain("github.event_name != 'pull_request'")
  })

  it('preserves the five live merge-gate contexts without classify', () => {
    const requiredContexts = [
      'lint',
      'test (ubuntu-latest)',
      'test (windows-latest)',
      'test (macos-latest)',
      'sandbox-tests',
    ]

    for (const context of requiredContexts) {
      expect(ciWorkflow + sandboxWorkflow).toContain(context)
    }

    expect(ciWorkflow).not.toContain('name: classify')
    expect(ciWorkflow).not.toContain('pr-governance.yml')
  })

  it('preserves PR governance on body edits', () => {
    const pullRequestBlock = ciWorkflow.slice(
      ciWorkflow.indexOf('pull_request:'),
      ciWorkflow.indexOf('workflow_dispatch:'),
    )

    expect(pullRequestBlock).toContain('edited')
    expect(pullRequestBlock).toContain('synchronize')
  })

  it('uses automatic release-please on protected-branch push', () => {
    expect(extractYamlList(extractEventBlock(releasePleaseWorkflow, 'push'), 'branches')).toEqual(['main', 'beta'])
    expect(releasePleaseWorkflow).toContain('skip-github-release: true')
    expect(releasePleaseWorkflow).toContain('tag-release-backstop')
    expect(releasePleaseWorkflow).toContain('ci:release-tag-backstop')
    expect(releasePleaseWorkflow).toContain('./.github/actions/setup-bun')
    expect(releasePleaseWorkflow).toContain('googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7')
    expect(releaseWorkflow).toContain('bun run ci:release-publish-contract')
    expect(releaseWorkflow).not.toContain('bun run test')
  })
})
