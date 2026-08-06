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
  it('routes CI context collection and scope classification through shared scripts', () => {
    expect(ciWorkflow).toContain('bun run ci:context')
    expect(ciWorkflow).toContain('bun run ci:path-taxonomy')
    expect(ciWorkflow).toContain('CHANGED_FILES_JSON')
    expect(ciWorkflow).not.toContain('const productImpactingPrefixes = [')
    expect(ciWorkflow).not.toContain('actions/github-script')
  })

  it('routes governance scope classification through the shared taxonomy outputs', () => {
    expect(ciWorkflow).toContain('governance:')
    expect(ciWorkflow).toContain('needs: classify')
    expect(ciWorkflow).toContain('bun run pr:body:check')
    expect(ciWorkflow).not.toContain("fileName.startsWith('src/')")
  })

  it('keeps sandbox tests off pull requests so they cost nothing per PR', () => {
    expect(sandboxWorkflow).not.toContain('pull_request')
    expect(sandboxWorkflow).toContain('schedule:')
    expect(sandboxWorkflow).toContain('workflow_dispatch:')
    // Change classification only ever gated the per-PR run; scheduled runs
    // always saw a null diff and ran the full set anyway.
    expect(sandboxWorkflow).not.toContain('bun run ci:path-taxonomy')
    expect(sandboxWorkflow).not.toContain('trusted_pr')
  })

  it('marks sandbox tests as advisory rather than a required gate', () => {
    expect(sandboxWorkflow).toContain('Advisory')
    expect(sandboxWorkflow).toContain('NOT a required merge gate')
  })

  it('runs CI for main only, because main is the only release channel', () => {
    expect(extractYamlList(extractEventBlock(ciWorkflow, 'pull_request'), 'branches')).toEqual(['main'])
    expect(extractYamlList(extractEventBlock(ciWorkflow, 'push'), 'branches')).toEqual(['main'])
  })

  it('cancels superseded CI and sandbox runs but never a release', () => {
    for (const workflow of [ciWorkflow, sandboxWorkflow]) {
      expect(workflow).toContain('concurrency:')
      expect(workflow).toContain('cancel-in-progress: true')
    }

    for (const fileName of ['release.yml', 'release-please.yml', 'release-core.yml']) {
      expect(readFileSync(`.github/workflows/${fileName}`, 'utf8')).toContain('cancel-in-progress: false')
    }
  })

  it('uses Node 24 in test jobs and includes workspace manifests in cache keys', () => {
    const setupBunAction = readFileSync('.github/actions/setup-bun/action.yml', 'utf8')

    expect(ciWorkflow).toContain('node-version: 24')
    expect(setupBunAction).toContain("hashFiles('bun.lock', 'package.json', 'packages/*/package.json')")
    expect(sandboxWorkflow).toContain('./.github/actions/setup-bun')
    expect(ciWorkflow).toContain('bun run package:check')
  })

  it('runs Windows tests for product-impacting pull requests', () => {
    expect(ciWorkflow).toContain('name: test (windows-latest)')
    expect(ciWorkflow).not.toContain("github.event_name != 'pull_request'")
  })

  it('preserves the live merge-gate contexts without classify', () => {
    const requiredContexts = [
      'lint',
      'governance',
      'test (ubuntu-latest)',
      'test (windows-latest)',
      'test (macos-latest)',
    ]

    for (const context of requiredContexts) {
      expect(ciWorkflow).toContain(context)
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
    expect(extractYamlList(extractEventBlock(releasePleaseWorkflow, 'push'), 'branches')).toEqual(['main'])
    expect(releasePleaseWorkflow).toContain('config-file: release-please-config.json')
    expect(releasePleaseWorkflow).toContain('skip-github-release: true')
    expect(releasePleaseWorkflow).toContain('tag-release')
    expect(releasePleaseWorkflow).toContain('ci:tag-release')
    expect(releasePleaseWorkflow).toContain('./.github/actions/setup-bun')
    expect(releasePleaseWorkflow).toContain('googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7')
    expect(releasePleaseWorkflow).not.toContain('workflow_dispatch')
  })

  it('runs the release pipeline through testable scripts instead of inline heredocs', () => {
    expect(releaseWorkflow).toContain('bun run release:candidate')
    expect(releaseWorkflow).toContain('bun run scripts/release/verify-release-candidate.ts download-check')
    expect(releaseWorkflow).toContain('bun run scripts/release/verify-release-candidate.ts npm-state')
    expect(releaseWorkflow).toContain('bun run scripts/release/verify-release-candidate.ts assets-check')
    expect(releaseWorkflow).toContain('bun run scripts/release/verify-release-candidate.ts registry-closure')
    expect(releaseWorkflow).not.toContain('node --input-type=module')
    expect(releaseWorkflow).not.toContain('bun run test')
  })
})
