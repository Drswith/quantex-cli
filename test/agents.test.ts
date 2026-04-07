import type { AgentDefinition, Platform } from '../src/agents/types'
import { describe, expect, it } from 'vitest'
import { getAgentByNameOrAlias, getAllAgents } from '../src/agents'
import { claudeCode } from '../src/agents/claude-code'
import { codex } from '../src/agents/codex'
import { droid } from '../src/agents/droid'
import { geminiCli } from '../src/agents/gemini-cli'
import { githubCopilotCli } from '../src/agents/github-copilot-cli'
import { opencode } from '../src/agents/opencode'
import { pi } from '../src/agents/pi'

describe('agent registry', () => {
  it('returns array with at least 7 agents', () => {
    const agents = getAllAgents()
    expect(agents.length).toBeGreaterThanOrEqual(7)
  })

  it('finds agent by name', () => {
    const agent = getAgentByNameOrAlias('claude-code')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('claude-code')
  })

  it('finds agent by alias', () => {
    const agent = getAgentByNameOrAlias('claude')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('claude-code')
  })

  it('returns undefined for unknown agent', () => {
    expect(getAgentByNameOrAlias('unknown-agent')).toBeUndefined()
  })
})

function validateAgent(agent: AgentDefinition): void {
  expect(agent.name).toBeTruthy()
  expect(agent.aliases).toBeInstanceOf(Array)
  expect(agent.displayName).toBeTruthy()
  expect(agent.description).toBeTruthy()
  expect(agent.homepage).toMatch(/^https:\/\//)
  expect(agent.package).toBeTruthy()
  expect(agent.binaryName).toBeTruthy()
  expect(agent.installMethods.length).toBeGreaterThan(0)

  for (const method of agent.installMethods) {
    expect(['bun', 'npm', 'binary']).toContain(method.type)
    expect(method.supportedPlatforms.length).toBeGreaterThan(0)
    expect(typeof method.priority).toBe('number')
    if (typeof method.command === 'string') {
      expect(method.command).toBeTruthy()
    }
    else {
      expect(typeof method.command).toBe('function')
    }
  }
}

describe('claude-code', () => {
  it('has valid structure', () => {
    validateAgent(claudeCode)
    expect(claudeCode.name).toBe('claude-code')
    expect(claudeCode.displayName).toBe('Claude Code')
    expect(claudeCode.package).toBe('@anthropic-ai/claude-code')
    expect(claudeCode.binaryName).toBe('claude')
    expect(claudeCode.aliases).toContain('claude')
  })

  it('curl install returns correct strings per platform', () => {
    const binaryMethods = claudeCode.installMethods.filter(m => m.type === 'binary')
    const curlMethod = binaryMethods.find((m) => {
      const fn = m.command as (p: Platform) => string
      return fn('macos').includes('curl')
    })
    expect(curlMethod).toBeDefined()
    const fn = curlMethod!.command as (platform: Platform) => string

    expect(fn('windows')).toContain('claude.ai/install.ps1')
    expect(fn('macos')).toContain('claude.ai/install.sh')
    expect(fn('linux')).toContain('claude.ai/install.sh')
  })

  it('package manager install returns correct strings per platform', () => {
    const binaryMethods = claudeCode.installMethods.filter(m => m.type === 'binary')
    const pmMethod = binaryMethods.find((m) => {
      const fn = m.command as (p: Platform) => string
      return fn('macos').includes('brew')
    })
    expect(pmMethod).toBeDefined()
    const fn = pmMethod!.command as (platform: Platform) => string

    expect(fn('windows')).toContain('winget')
    expect(fn('macos')).toContain('brew')
    expect(fn('linux')).toContain('brew')
  })
})

describe('codex', () => {
  it('has valid structure', () => {
    validateAgent(codex)
    expect(codex.name).toBe('codex')
    expect(codex.displayName).toBe('Codex CLI')
    expect(codex.package).toBe('@openai/codex')
    expect(codex.binaryName).toBe('codex')
  })

  it('binary command function returns correct strings per platform', () => {
    const binaryMethod = codex.installMethods.find(m => m.type === 'binary')
    expect(binaryMethod).toBeDefined()
    expect(binaryMethod!.supportedPlatforms).not.toContain('windows')
    const fn = binaryMethod!.command as (platform: Platform) => string

    expect(fn('macos')).toBe('brew install codex')
    expect(fn('linux')).toBe('brew install codex')
  })
})

describe('droid', () => {
  it('has valid structure', () => {
    validateAgent(droid)
    expect(droid.name).toBe('droid')
    expect(droid.displayName).toBe('Droid')
    expect(droid.package).toBe('droid')
    expect(droid.binaryName).toBe('droid')
  })

  it('curl install returns correct strings per platform', () => {
    const binaryMethods = droid.installMethods.filter(m => m.type === 'binary')
    const curlMethod = binaryMethods.find((m) => {
      const fn = m.command as (p: Platform) => string
      return fn('macos').includes('curl')
    })
    expect(curlMethod).toBeDefined()
    const fn = curlMethod!.command as (platform: Platform) => string

    expect(fn('windows')).toContain('irm')
    expect(fn('macos')).toContain('app.factory.ai/cli')
    expect(fn('linux')).toContain('app.factory.ai/cli')
  })

  it('brew install returns correct strings per platform', () => {
    const binaryMethods = droid.installMethods.filter(m => m.type === 'binary')
    const brewMethod = binaryMethods.find((m) => {
      const fn = m.command as (p: Platform) => string
      return fn('macos').includes('brew')
    })
    expect(brewMethod).toBeDefined()
    const fn = brewMethod!.command as (platform: Platform) => string

    expect(fn('macos')).toBe('brew install --cask droid')
    expect(fn('linux')).toBe('brew install --cask droid')
    expect(brewMethod!.supportedPlatforms).not.toContain('windows')
  })
})

describe('gemini-cli', () => {
  it('has valid structure', () => {
    validateAgent(geminiCli)
    expect(geminiCli.name).toBe('gemini-cli')
    expect(geminiCli.displayName).toBe('Gemini CLI')
    expect(geminiCli.package).toBe('@google/gemini-cli')
    expect(geminiCli.binaryName).toBe('gemini')
    expect(geminiCli.aliases).toContain('gemini')
  })

  it('brew install returns correct strings per platform', () => {
    const binaryMethod = geminiCli.installMethods.find(m => m.type === 'binary')
    expect(binaryMethod).toBeDefined()
    expect(binaryMethod!.supportedPlatforms).not.toContain('windows')
    const fn = binaryMethod!.command as (platform: Platform) => string

    expect(fn('macos')).toBe('brew install gemini-cli')
    expect(fn('linux')).toBe('brew install gemini-cli')
  })
})

describe('github-copilot-cli', () => {
  it('has valid structure', () => {
    validateAgent(githubCopilotCli)
    expect(githubCopilotCli.name).toBe('github-copilot-cli')
    expect(githubCopilotCli.displayName).toBe('GitHub Copilot CLI')
    expect(githubCopilotCli.package).toBe('@github/copilot')
    expect(githubCopilotCli.binaryName).toBe('copilot')
    expect(githubCopilotCli.aliases).toContain('copilot')
  })

  it('script install returns correct strings per platform', () => {
    const binaryMethods = githubCopilotCli.installMethods.filter(m => m.type === 'binary')
    const scriptMethod = binaryMethods.find((m) => {
      const fn = m.command as (p: Platform) => string
      return fn('macos').includes('curl')
    })
    expect(scriptMethod).toBeDefined()
    const fn = scriptMethod!.command as (platform: Platform) => string

    expect(fn('windows')).toContain('winget')
    expect(fn('macos')).toContain('gh.io/copilot-install')
    expect(fn('linux')).toContain('gh.io/copilot-install')
  })

  it('brew install returns correct strings per platform', () => {
    const binaryMethods = githubCopilotCli.installMethods.filter(m => m.type === 'binary')
    const brewMethod = binaryMethods.find((m) => {
      const fn = m.command as (p: Platform) => string
      return fn('macos').includes('brew')
    })
    expect(brewMethod).toBeDefined()
    const fn = brewMethod!.command as (platform: Platform) => string

    expect(fn('macos')).toBe('brew install copilot-cli')
    expect(fn('linux')).toBe('brew install copilot-cli')
    expect(brewMethod!.supportedPlatforms).not.toContain('windows')
  })
})

describe('opencode', () => {
  it('has valid structure', () => {
    validateAgent(opencode)
    expect(opencode.name).toBe('opencode')
    expect(opencode.displayName).toBe('OpenCode')
    expect(opencode.package).toBe('opencode-ai')
    expect(opencode.binaryName).toBe('opencode')
  })

  it('curl install returns correct strings per platform', () => {
    const binaryMethods = opencode.installMethods.filter(m => m.type === 'binary')
    const curlMethod = binaryMethods.find((m) => {
      const fn = m.command as (p: Platform) => string
      return fn('macos').includes('curl')
    })
    expect(curlMethod).toBeDefined()
    const fn = curlMethod!.command as (platform: Platform) => string

    expect(fn('macos')).toContain('opencode.ai/install')
    expect(fn('linux')).toContain('opencode.ai/install')
    expect(curlMethod!.supportedPlatforms).not.toContain('windows')
  })

  it('brew install returns correct strings per platform', () => {
    const binaryMethods = opencode.installMethods.filter(m => m.type === 'binary')
    const brewMethod = binaryMethods.find((m) => {
      const fn = m.command as (p: Platform) => string
      return fn('macos').includes('brew')
    })
    expect(brewMethod).toBeDefined()
    const fn = brewMethod!.command as (platform: Platform) => string

    expect(fn('macos')).toBe('brew install anomalyco/tap/opencode')
    expect(fn('linux')).toBe('brew install anomalyco/tap/opencode')
    expect(brewMethod!.supportedPlatforms).not.toContain('windows')
  })
})

describe('pi', () => {
  it('has valid structure', () => {
    validateAgent(pi)
    expect(pi.name).toBe('pi')
    expect(pi.displayName).toBe('Pi')
    expect(pi.package).toBe('@mariozechner/pi-coding-agent')
    expect(pi.binaryName).toBe('pi')
  })
})

describe('agent identifiers', () => {
  it('has no duplicate names or aliases across agents', () => {
    const agents = getAllAgents()
    const seen = new Map<string, string>()
    for (const agent of agents) {
      const identifiers = [agent.name, ...agent.aliases]
      for (const id of identifiers) {
        const existingAgent = seen.get(id)
        if (existingAgent && existingAgent !== agent.name) {
          throw new Error(`Duplicate identifier "${id}" in "${existingAgent}" and "${agent.name}"`)
        }
        seen.set(id, agent.name)
      }
    }
  })

  it('agent names are lowercase', () => {
    for (const agent of getAllAgents()) {
      expect(agent.name).toBe(agent.name.toLowerCase())
    }
  })

  it('displayNames are not all lowercase', () => {
    for (const agent of getAllAgents()) {
      expect(agent.displayName).not.toBe(agent.displayName.toLowerCase())
    }
  })
})
