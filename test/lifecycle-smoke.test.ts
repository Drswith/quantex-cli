import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const lifecycleSmoke = readFileSync('scripts/smoke/lifecycle-smoke.ts', 'utf8')
const pmLifecycleSmoke = readFileSync('scripts/smoke/pm-lifecycle-smoke.ts', 'utf8')

describe('lifecycle smoke scenarios', () => {
  it('includes deno-managed coverage in the default scenario list', () => {
    expect(lifecycleSmoke).toContain("'deno-managed'")
    expect(lifecycleSmoke).toContain("scenarios.includes('deno-managed')")
  })

  it('asserts deno global executable lifecycle commands in the fake deno scenario', () => {
    expect(lifecycleSmoke).toContain(
      'deno install --global --allow-net --name deno-smoke-agent jsr:@scope/deno-smoke-agent',
    )
    expect(lifecycleSmoke).toContain(
      'deno install --global --force --allow-net --name deno-smoke-agent jsr:@scope/deno-smoke-agent',
    )
    expect(lifecycleSmoke).toContain('deno uninstall --global deno-smoke-agent')
    expect(pmLifecycleSmoke).toContain('packages: {\n      deno: DENO_PACKAGE_NAME,')
    expect(lifecycleSmoke).toContain("'scripts/smoke/pm-lifecycle-smoke.ts', 'deno'")
  })

  it('includes uv-managed coverage in the default scenario list', () => {
    expect(lifecycleSmoke).toContain("'uv-managed'")
    expect(lifecycleSmoke).toContain("scenarios.includes('uv-managed')")
  })

  it('includes a focused real-agent probe with version assertions', () => {
    expect(lifecycleSmoke).toContain("scenarios.includes('probe')")
    expect(lifecycleSmoke).toContain('QTX_CANARY_REQUIRE_VERSION')
    expect(lifecycleSmoke).toContain("QTX_CANARY_COVERAGE === 'binary-lifecycle'")
    expect(lifecycleSmoke).not.toContain('QTX_CANARY_SKIP_REASON')
    expect(lifecycleSmoke).not.toContain('QTX_CANARY_CLEANUP_SKIP_REASON')
    expect(lifecycleSmoke).not.toContain('recordCanarySkip')
    expect(lifecycleSmoke).toContain('executable after failed cleanup')
    expect(lifecycleSmoke).toContain('result.ok === true && result.data?.changed === true')
    expect(lifecycleSmoke).toContain('canUninstallInstallType')
    expect(lifecycleSmoke).toContain("result.error.details?.lifecycle === 'conflicting-source'")
    expect(lifecycleSmoke).toContain('smokeAgentSourceConflict(agent)')
    expect(lifecycleSmoke).not.toContain('conflict final cleanup')
    expect(lifecycleSmoke).toContain("warning.code === 'TRACKED_EXISTING_INSTALL'")
    expect(lifecycleSmoke).toContain('physical cleanup delegated to disposable runner')
    expect(lifecycleSmoke).toContain('installedVersion')
    expect(lifecycleSmoke).toContain("'list', '--refresh'")
    expect(lifecycleSmoke).toContain("const RECEIPT_VALIDATION_AGENT = 'opencode'")
    expect(lifecycleSmoke).toContain("resolveCanaryProvider() !== 'bun'")
    expect(lifecycleSmoke).toContain("'bun',\n      'add',\n      '-g'")
    expect(lifecycleSmoke).toContain("[...cli, '--refresh', 'update', agent]")
    expect(lifecycleSmoke).toContain("candidate.status === 'updated'")
    expect(lifecycleSmoke).toContain('lifecycleReceipts')
    expect(lifecycleSmoke).toContain('real update coverage cannot run')
    expect(lifecycleSmoke).toContain('receipt-validation update must persist executableName')
    expect(lifecycleSmoke).toContain(
      'installedAgents.push(agent)\n      await smokeAgentVersionProbe(agent)\n      installedAgents.pop()',
    )
    expect(lifecycleSmoke).not.toContain('await smokeAgentVersionProbe(agent)\n      } finally {')
  })

  it('only writes product-supported default package-manager values', () => {
    expect(lifecycleSmoke).toContain(
      "provider === 'bun' || provider === 'mise' || provider === 'npm' || provider === 'uv'",
    )
    expect(lifecycleSmoke).not.toContain('isManagedInstallType(provider) ? provider')
  })

  it('asserts uv tool lifecycle commands in the fake uv scenario', () => {
    expect(lifecycleSmoke).toContain('uv tool install uv-smoke-agent --python 3.12')
    expect(lifecycleSmoke).toContain('uv tool upgrade uv-smoke-agent --python 3.12')
    expect(lifecycleSmoke).toContain('uv tool uninstall uv-smoke-agent')
    expect(lifecycleSmoke).toContain('uv tool list')
    expect(pmLifecycleSmoke).toContain("getManagedInstalledPackageVersion('uv', UV_PACKAGE_NAME)")
    expect(lifecycleSmoke).toContain("'scripts/smoke/pm-lifecycle-smoke.ts', 'uv'")
  })

  it('routes cargo scenarios through the shared pm lifecycle smoke', () => {
    expect(lifecycleSmoke).toContain("'scripts/smoke/pm-lifecycle-smoke.ts', 'cargo'")
    expect(pmLifecycleSmoke).toContain('QTX_CARGO_SMOKE_AGENT')
  })
})
