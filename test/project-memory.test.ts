import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const template = readFileSync('skills/quantex-agent-runtime/bootstrap-stub.md', 'utf8')
const stubPaths = [
  '.agents/skills/quantex-agent-runtime/SKILL.md',
  '.codex/skills/quantex-agent-runtime/SKILL.md',
  '.github/skills/quantex-agent-runtime/SKILL.md',
]

describe('project memory', () => {
  it.each(stubPaths)('keeps the %s bootstrap stub byte-identical to the template', stubPath => {
    expect(readFileSync(stubPath, 'utf8')).toBe(template)
  })

  it('keeps the bootstrap stub thin and routed at the central runtime', () => {
    expect(template).toContain('skills/quantex-agent-runtime/SKILL.md')
    expect(template).not.toContain('## Validation')
    expect(template.length).toBeLessThan(2000)
  })
})
