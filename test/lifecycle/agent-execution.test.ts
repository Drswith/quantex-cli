import type { AgentExecutionPreflightInput, AgentExecutionPreflightPlan } from '../../src/lifecycle/agent-execution'
import { describe, expect, it } from 'vitest'
import { planAgentExecutionPreflight } from '../../src/lifecycle/agent-execution'

const presentObservation = {
  drift: { kind: 'none' as const },
  executablePath: '/tmp/test-agent',
  kind: 'present' as const,
  targetId: 'test-agent',
}

const absentObservation = {
  drift: { kind: 'none' as const },
  kind: 'absent' as const,
  targetId: 'test-agent',
}

describe('planAgentExecutionPreflight', () => {
  it.each<{
    expected: AgentExecutionPreflightPlan
    input: AgentExecutionPreflightInput
    label: string
  }>([
    {
      expected: { decision: 'launch' },
      input: input({ installPolicy: 'never' }),
      label: 'launches a present executable with the explicit exec default',
    },
    {
      expected: { decision: 'launch' },
      input: input({ installPolicy: 'always' }),
      label: 'does not reinstall a present executable for the compatibility always policy',
    },
    {
      expected: { decision: 'dry-run' },
      input: input({ dryRun: true, installPolicy: 'prompt' }),
      label: 'projects a present interactive shortcut as a dry run',
    },
    {
      expected: { decision: 'reject', errorCode: 'AGENT_NOT_INSTALLED' },
      input: input({ executablePresent: false, installPolicy: 'never' }),
      label: 'rejects an absent executable when installation is forbidden',
    },
    {
      expected: { decision: 'reject', errorCode: 'AGENT_NOT_INSTALLED' },
      input: input({ dryRun: true, executablePresent: false, installPolicy: 'never' }),
      label: 'keeps the never policy authoritative during dry run',
    },
    {
      expected: { decision: 'install-and-launch' },
      input: input({ executablePresent: false, installPolicy: 'if-missing' }),
      label: 'installs an absent executable for if-missing',
    },
    {
      expected: { decision: 'install-and-launch' },
      input: input({ executablePresent: false, installPolicy: 'always' }),
      label: 'installs an absent executable for always',
    },
    {
      expected: { decision: 'dry-run' },
      input: input({ dryRun: true, executablePresent: false, installPolicy: 'if-missing' }),
      label: 'does not install an absent executable during dry run',
    },
    {
      expected: { decision: 'prompt-install' },
      input: input({ executablePresent: false, installPolicy: 'prompt' }),
      label: 'requests confirmation for an interactive shortcut',
    },
    {
      expected: { decision: 'dry-run' },
      input: input({ dryRun: true, executablePresent: false, installPolicy: 'prompt' }),
      label: 'does not prompt for an interactive shortcut dry run',
    },
    {
      expected: { decision: 'reject', errorCode: 'INTERACTION_REQUIRED' },
      input: input({ executablePresent: false, installPolicy: 'prompt', interactive: false }),
      label: 'rejects a prompt policy when interaction is unavailable',
    },
    {
      expected: { decision: 'reject', errorCode: 'INTERACTION_REQUIRED' },
      input: input({ dryRun: true, executablePresent: false, installPolicy: 'prompt', interactive: false }),
      label: 'preserves the non-interactive prompt rejection during dry run',
    },
  ])('$label', ({ expected, input: scenario }) => {
    expect(planAgentExecutionPreflight(scenario)).toEqual(expected)
  })

  it.each([
    {
      executable: { path: '/tmp/test-agent', present: true, version: '1.0.0' },
      observation: {
        drift: {
          kind: 'conflicting-source' as const,
          observedProviderId: 'npm',
          recordedProviderId: 'bun',
        },
        executablePath: '/tmp/test-agent',
        kind: 'present' as const,
        targetId: 'test-agent',
      },
    },
    {
      executable: { path: '/tmp/test-agent', present: true },
      observation: {
        drift: { kind: 'indeterminate' as const, reason: 'provider probe unavailable' },
        kind: 'indeterminate' as const,
        reason: 'provider probe unavailable',
        targetId: 'test-agent',
      },
    },
  ])('keeps a live executable launchable despite provider uncertainty', scenario => {
    expect(
      planAgentExecutionPreflight({
        dryRun: false,
        installPolicy: 'never',
        interactive: false,
        ...scenario,
      }),
    ).toEqual({ decision: 'launch' })
  })

  it('is deterministic and leaves its input unchanged', () => {
    const scenario = input({ executablePresent: false, installPolicy: 'if-missing' })
    const before = structuredClone(scenario)

    expect(planAgentExecutionPreflight(scenario)).toEqual(planAgentExecutionPreflight(scenario))
    expect(scenario).toEqual(before)
  })
})

function input(
  overrides: Partial<
    Pick<AgentExecutionPreflightInput, 'dryRun' | 'installPolicy' | 'interactive'> & {
      executablePresent: boolean
    }
  > = {},
): AgentExecutionPreflightInput {
  const executablePresent = overrides.executablePresent ?? true
  return {
    dryRun: overrides.dryRun ?? false,
    executable: executablePresent ? { path: '/tmp/test-agent', present: true } : { present: false },
    installPolicy: overrides.installPolicy ?? 'prompt',
    interactive: overrides.interactive ?? true,
    observation: executablePresent ? presentObservation : absentObservation,
  }
}
