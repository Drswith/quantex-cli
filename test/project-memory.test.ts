import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const template = readFileSync('skills/quantex-agent-runtime/bootstrap-stub.md', 'utf8')
const stubPaths = [
  '.agents/skills/quantex-agent-runtime/SKILL.md',
  '.claude/skills/quantex-agent-runtime/SKILL.md',
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

  // Read modes from the index rather than the filesystem: a checkout without
  // symlink support materializes a symlink as a regular file, which would hide
  // the regression on exactly the platform it hurts.
  it('tracks every agent bootstrap path as a regular file, never a symlink', () => {
    const tracked = execFileSync('git', ['ls-files', '-s', '--', '.agents', '.claude', '.codex', '.github/skills'], {
      encoding: 'utf8',
    })

    const symlinked = tracked
      .split('\n')
      .filter(line => line.startsWith('120000'))
      .map(line => line.split('\t')[1])

    expect(symlinked).toEqual([])
  })
})
