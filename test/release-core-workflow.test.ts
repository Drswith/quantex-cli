import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync('.github/workflows/release-core.yml', 'utf8')

describe('Core release workflow', () => {
  it('uses manual OIDC publication with an immutable Core-only source', () => {
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('id-token: write')
    expect(workflow).toContain('core-v${package_version}')
    expect(workflow).toContain('npm publish --access public --ignore-scripts --tag latest')
    expect(workflow).toContain('bun run package:check:core')
  })

  it('does not inherit CLI release orchestration or artifacts', () => {
    expect(workflow).not.toContain('release-please')
    expect(workflow).not.toContain('release-target-resolution')
    expect(workflow).not.toContain('gh release')
    expect(workflow).not.toContain('build:bin')
    expect(workflow).not.toContain('quantex-cli')
  })
})
