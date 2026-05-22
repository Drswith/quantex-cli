import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const lifecycleSmoke = readFileSync('scripts/lifecycle-smoke.ts', 'utf8')
const uvLifecycleSmoke = readFileSync('scripts/uv-lifecycle-smoke.ts', 'utf8')

describe('lifecycle smoke scenarios', () => {
  it('includes uv-managed coverage in the default scenario list', () => {
    expect(lifecycleSmoke).toContain("'uv-managed'")
    expect(lifecycleSmoke).toContain("scenarios.includes('uv-managed')")
  })

  it('asserts uv tool lifecycle commands in the fake uv scenario', () => {
    expect(lifecycleSmoke).toContain('uv tool install uv-smoke-agent --python 3.12')
    expect(lifecycleSmoke).toContain('uv tool upgrade uv-smoke-agent --python 3.12')
    expect(lifecycleSmoke).toContain('uv tool uninstall uv-smoke-agent')
    expect(lifecycleSmoke).toContain('uv tool list')
    expect(uvLifecycleSmoke).toContain("getManagedInstalledPackageVersion('uv', PACKAGE_NAME)")
  })
})
