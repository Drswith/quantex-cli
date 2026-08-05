import { describe, expect, it } from 'vitest'
import { planReleaseCandidateSteps } from '../scripts/release/release-candidate'

describe('release candidate pipeline', () => {
  it('runs the seal contract before any build step in CI mode', () => {
    const steps = planReleaseCandidateSteps({ local: false })

    expect(steps[0]).toEqual({
      command: ['bun', 'run', 'ci:release-publish-contract'],
      name: 'Validate immutable release identity',
    })
  })

  it('skips the seal contract for local dry-runs but keeps the full build chain', () => {
    const steps = planReleaseCandidateSteps({ local: true })
    const commands = steps.map(step => step.command.join(' '))

    expect(commands).toEqual([
      'bun run build',
      'bun run build:bin',
      'bun run release:artifacts',
      'bun run release:smoke',
      'bun run package:check:core',
      'bun run scripts/release/stage-release-candidate.ts release-candidate',
    ])
  })

  it('builds before staging in both modes', () => {
    for (const local of [false, true]) {
      const commands = planReleaseCandidateSteps({ local }).map(step => step.command.join(' '))
      expect(commands.indexOf('bun run build')).toBeLessThan(commands.indexOf('bun run release:artifacts'))
      expect(commands.indexOf('bun run release:artifacts')).toBeLessThan(
        commands.indexOf('bun run scripts/release/stage-release-candidate.ts release-candidate'),
      )
    }
  })
})
