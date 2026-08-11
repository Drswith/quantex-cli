import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const releasePleaseWorkflow = readFileSync('.github/workflows/release-please.yml', 'utf8')
const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8')
const sandboxWorkflow = readFileSync('.github/workflows/sandbox-tests.yml', 'utf8')
const agentCanaryWorkflow = readFileSync('.github/workflows/agent-canary.yml', 'utf8')

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

  it('runs quick real-agent canaries on relevant PRs and full coverage on schedule/manual dispatch', () => {
    expect(agentCanaryWorkflow).toContain('pull_request:')
    expect(agentCanaryWorkflow).toContain('workflow_dispatch:')
    expect(agentCanaryWorkflow).toContain('schedule:')
    expect(agentCanaryWorkflow).toContain('bun scripts/ci/agent-canary-matrix.ts')
    expect(agentCanaryWorkflow).toContain('QTX_ISOLATION_SCENARIOS: probe')
    expect(agentCanaryWorkflow).toContain('HOME: /tmp/quantex-home')
    expect(agentCanaryWorkflow).toContain('QTX_CANARY_REQUIRE_VERSION')
    expect(agentCanaryWorkflow).toContain('QTX_CANARY_COVERAGE')
    expect(agentCanaryWorkflow).toContain('QTX_CANARY_SOURCE_CONFLICT')
    expect(agentCanaryWorkflow).toContain("CONFIGURE: ${{ matrix.setup == 'skip-interactive-configuration'")
    expect(agentCanaryWorkflow).toContain('DISABLE_AUTOUPDATER')
    expect(agentCanaryWorkflow).toContain('DISABLE_UPDATES')
    expect(agentCanaryWorkflow).toContain('Acquire Devin binary without account setup')
    expect(agentCanaryWorkflow).toContain('Account setup and authentication: deferred')
    expect(agentCanaryWorkflow).toContain('Record Devin binary lifecycle result')
    expect(agentCanaryWorkflow).toContain('Quantex adoption, inspect, list, version, and untracking: verified')
    expect(agentCanaryWorkflow).toContain('echo "$HOME/.local/bin" >> "$GITHUB_PATH"')
    expect(agentCanaryWorkflow).not.toContain('QTX_CANARY_SKIP_REASON')
    expect(agentCanaryWorkflow).not.toContain('QTX_CANARY_CLEANUP_SKIP_REASON')
    expect(agentCanaryWorkflow).toContain('denoland/setup-deno@22d081ff2d3a40755e97629de92e3bcbfa7cf2ed')
    expect(agentCanaryWorkflow).toContain('astral-sh/setup-uv@c771a70e6277c0a99b617c7a806ffedaca235ff9')
    expect(agentCanaryWorkflow).toContain('bun-version: 1.3.14')
    expect(agentCanaryWorkflow).not.toContain('MODAL_TOKEN')
  })

  it('keeps canary workflow advisory and cancels only superseded PR runs', () => {
    expect(agentCanaryWorkflow).toContain('not a required')
    expect(agentCanaryWorkflow).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}")
  })

  it('runs CI for main only, because main is the only release channel', () => {
    expect(extractYamlList(extractEventBlock(ciWorkflow, 'pull_request'), 'branches')).toEqual(['main'])
    expect(extractYamlList(extractEventBlock(ciWorkflow, 'push'), 'branches')).toEqual(['main'])
  })

  it('cancels superseded CI and sandbox runs but never a release', () => {
    for (const workflow of [ciWorkflow, sandboxWorkflow, agentCanaryWorkflow]) {
      expect(workflow).toContain('concurrency:')
    }

    for (const fileName of ['release.yml', 'release-please.yml', 'release-core.yml']) {
      expect(readFileSync(`.github/workflows/${fileName}`, 'utf8')).toContain('cancel-in-progress: false')
    }
  })

  // A push run cancelled by a later merge leaves that SHA permanently without a
  // successful ci.yml run, which is exactly what tag-release requires before it
  // will tag a release. Keying push runs by commit keeps them from colliding.
  it('never cancels a CI push run, so a back-to-back merge cannot cost a release', () => {
    expect(ciWorkflow).toContain('group: ci-${{ github.event.pull_request.number || github.sha }}')
    expect(ciWorkflow).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}")
    expect(ciWorkflow).not.toContain('github.event.pull_request.number || github.ref')
  })

  it('uses Node 24 in test jobs and includes workspace manifests in cache keys', () => {
    const setupBunAction = readFileSync('.github/actions/setup-bun/action.yml', 'utf8')

    expect(ciWorkflow).toContain('node-version: 24')
    expect(setupBunAction).toContain('bun-version: ${{ inputs.bun-version }}')
    expect(setupBunAction).toContain('default: 1.3.14')
    expect(setupBunAction).toContain("hashFiles('bun.lock', 'package.json', 'packages/*/package.json')")
    expect(sandboxWorkflow).toContain('./.github/actions/setup-bun')
    expect(ciWorkflow).toContain('bun run package:check')
  })

  it('runs Windows tests for product-impacting pull requests', () => {
    expect(ciWorkflow).toContain('name: test (windows-latest)')
    expect(ciWorkflow).not.toContain("github.event_name != 'pull_request'")
  })

  // Windows used to pass --pool=threads, which runs every worker inside one
  // process and one V8 instance. It was the only difference between the Windows
  // job and the other two, and the only platform where the job intermittently
  // died reporting no failing test. Measured 3/10 with the flag, 0/9 without.
  it('lets every platform job use the default Vitest pool', () => {
    expect(ciWorkflow).not.toContain('--pool')

    const testCommands = ciWorkflow.match(/run: bun run test.*/g) ?? []
    expect(testCommands.length).toBeGreaterThanOrEqual(3)
    expect(new Set(testCommands).size).toBe(1)
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
