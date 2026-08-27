import type { InstallMethod } from '../src/agents'
import type { InstalledAgentState } from '../src/state'
import { describe, expect, it } from 'vitest'
import { pi } from '../src/agents'
import { resolveSupersededPackage } from '../src/agents/superseded'
import { getLatestVersionPackage } from '../src/utils/install'

const SUPERSEDED = '@mariozechner/pi-coding-agent'
const CURRENT = '@earendil-works/pi-coding-agent'

const bunMethods: InstallMethod[] = [{ packageName: CURRENT, type: 'bun' }]

function recorded(packageName: string, installType: InstalledAgentState['installType'] = 'bun'): InstalledAgentState {
  return { agentName: 'pi', installType, packageName }
}

describe('resolveSupersededPackage', () => {
  it('reports the migration for an install recorded under the previous package', () => {
    expect(resolveSupersededPackage(pi, recorded(SUPERSEDED))).toEqual({
      currentPackage: CURRENT,
      recordedPackage: SUPERSEDED,
    })
  })

  it('matches the declaration across every provider that shares the npm identifier', () => {
    expect(resolveSupersededPackage(pi, recorded(SUPERSEDED, 'npm'))?.recordedPackage).toBe(SUPERSEDED)
  })

  it('returns nothing for an install already on the current package', () => {
    expect(resolveSupersededPackage(pi, recorded(CURRENT))).toBeUndefined()
  })

  it('returns nothing without a recorded install', () => {
    expect(resolveSupersededPackage(pi, undefined)).toBeUndefined()
  })

  it('returns nothing for an install type that carries no package identity', () => {
    expect(resolveSupersededPackage(pi, recorded(SUPERSEDED, 'script'))).toBeUndefined()
  })

  it('returns nothing for an agent that declares no superseded packages', () => {
    const agent = { name: 'claude', packages: { npm: '@anthropic-ai/claude-code' } }

    expect(resolveSupersededPackage(agent, { installType: 'bun', packageName: SUPERSEDED })).toBeUndefined()
  })
})

describe('getLatestVersionPackage', () => {
  it('resolves no package for an install recorded under a superseded identifier', () => {
    expect(getLatestVersionPackage(pi, recorded(SUPERSEDED), bunMethods)).toBeUndefined()
  })

  it('does not substitute the current identifier for the superseded one', () => {
    expect(getLatestVersionPackage(pi, recorded(SUPERSEDED), bunMethods)).not.toBe(CURRENT)
  })

  it('resolves the recorded package when it is the current identifier', () => {
    expect(getLatestVersionPackage(pi, recorded(CURRENT), bunMethods)).toBe(CURRENT)
  })

  it('resolves the catalog package when nothing is recorded', () => {
    expect(getLatestVersionPackage(pi, undefined, bunMethods)).toBe(CURRENT)
  })
})
