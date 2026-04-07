import type { AgentDefinition } from '../src/agents/types'
import { describe, expect, it } from 'vitest'
import { getAgentByNameOrAlias, getAllAgents } from '../src/agents'
import { claudeCode } from '../src/agents/claude-code'
import { codex } from '../src/agents/codex'
import { copilot } from '../src/agents/copilot'
import { cursor } from '../src/agents/cursor'
import { droid } from '../src/agents/droid'
import { gemini } from '../src/agents/gemini'
import { opencode } from '../src/agents/opencode'
import { pi } from '../src/agents/pi'

describe('agent registry', () => {
  it('returns array with at least 8 agents', () => {
    const agents = getAllAgents()
    expect(agents.length).toBeGreaterThanOrEqual(8)
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
  expect(agent.package).toBeDefined()
  expect(agent.binaryName).toBeTruthy()
  expect(Object.keys(agent.platforms).length).toBeGreaterThan(0)

  for (const [platform, methods] of Object.entries(agent.platforms)) {
    expect(['windows', 'macos', 'linux']).toContain(platform)
    expect(methods!.length).toBeGreaterThan(0)
    for (const method of methods!) {
      expect(['bun', 'npm', 'binary']).toContain(method.type)
      expect(typeof method.command).toBe('string')
      expect(method.command.length).toBeGreaterThan(0)
      expect(typeof method.priority).toBe('number')
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
    expect(claudeCode.platforms.windows!.find(m => m.type === 'binary' && m.command.includes('claude.ai/install.ps1'))).toBeDefined()
    expect(claudeCode.platforms.macos!.find(m => m.type === 'binary' && m.command.includes('claude.ai/install.sh'))).toBeDefined()
    expect(claudeCode.platforms.linux!.find(m => m.type === 'binary' && m.command.includes('claude.ai/install.sh'))).toBeDefined()
  })

  it('package manager install returns correct strings per platform', () => {
    expect(claudeCode.platforms.windows!.find(m => m.type === 'binary' && m.command.includes('winget'))).toBeDefined()
    expect(claudeCode.platforms.macos!.find(m => m.type === 'binary' && m.command.includes('brew'))).toBeDefined()
    expect(claudeCode.platforms.linux!.find(m => m.type === 'binary' && m.command.includes('brew'))).toBeDefined()
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

  it('binary command returns correct strings per platform', () => {
    expect(codex.platforms.macos!.find(m => m.command === 'brew install codex')).toBeDefined()
    expect(codex.platforms.linux!.find(m => m.command === 'brew install codex')).toBeDefined()
    expect(codex.platforms.windows!.find(m => m.type === 'binary')).toBeUndefined()
  })
})

describe('copilot', () => {
  it('has valid structure', () => {
    validateAgent(copilot)
    expect(copilot.name).toBe('copilot')
    expect(copilot.displayName).toBe('GitHub Copilot CLI')
    expect(copilot.package).toBe('@github/copilot')
    expect(copilot.binaryName).toBe('copilot')
    expect(copilot.aliases).toContain('gh-copilot')
  })

  it('script install returns correct strings per platform', () => {
    expect(copilot.platforms.windows!.find(m => m.type === 'binary' && m.command.includes('winget'))).toBeDefined()
    expect(copilot.platforms.macos!.find(m => m.type === 'binary' && m.command.includes('curl'))).toBeDefined()
    expect(copilot.platforms.linux!.find(m => m.type === 'binary' && m.command.includes('curl'))).toBeDefined()
  })

  it('brew install returns correct strings per platform', () => {
    expect(copilot.platforms.macos!.find(m => m.command === 'brew install copilot-cli')).toBeDefined()
    expect(copilot.platforms.linux!.find(m => m.command === 'brew install copilot-cli')).toBeDefined()
    expect(copilot.platforms.windows!.find(m => m.command.includes('brew'))).toBeUndefined()
  })
})

describe('cursor', () => {
  it('has valid structure', () => {
    validateAgent(cursor)
    expect(cursor.name).toBe('cursor')
    expect(cursor.displayName).toBe('Cursor CLI')
    expect(cursor.binaryName).toBe('agent')
  })

  it('binary install returns correct strings per platform', () => {
    expect(cursor.platforms.macos!.find(m => m.command.includes('cursor.com/install'))).toBeDefined()
    expect(cursor.platforms.linux!.find(m => m.command.includes('cursor.com/install'))).toBeDefined()
    expect(cursor.platforms.windows!.find(m => m.command.includes('cursor.com/install'))).toBeDefined()
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
    expect(droid.platforms.windows!.find(m => m.type === 'binary' && m.command.includes('irm'))).toBeDefined()
    expect(droid.platforms.macos!.find(m => m.type === 'binary' && m.command.includes('app.factory.ai/cli'))).toBeDefined()
    expect(droid.platforms.linux!.find(m => m.type === 'binary' && m.command.includes('app.factory.ai/cli'))).toBeDefined()
  })

  it('brew install returns correct strings per platform', () => {
    expect(droid.platforms.macos!.find(m => m.command === 'brew install --cask droid')).toBeDefined()
    expect(droid.platforms.linux!.find(m => m.command === 'brew install --cask droid')).toBeDefined()
    expect(droid.platforms.windows!.find(m => m.command.includes('brew'))).toBeUndefined()
  })
})

describe('gemini', () => {
  it('has valid structure', () => {
    validateAgent(gemini)
    expect(gemini.name).toBe('gemini')
    expect(gemini.displayName).toBe('Gemini CLI')
    expect(gemini.package).toBe('@google/gemini-cli')
    expect(gemini.binaryName).toBe('gemini')
    expect(gemini.aliases).toEqual([])
  })

  it('brew install returns correct strings per platform', () => {
    expect(gemini.platforms.macos!.find(m => m.command === 'brew install gemini-cli')).toBeDefined()
    expect(gemini.platforms.linux!.find(m => m.command === 'brew install gemini-cli')).toBeDefined()
    expect(gemini.platforms.windows!.find(m => m.type === 'binary')).toBeUndefined()
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
    expect(opencode.platforms.macos!.find(m => m.type === 'binary' && m.command.includes('opencode.ai/install'))).toBeDefined()
    expect(opencode.platforms.linux!.find(m => m.type === 'binary' && m.command.includes('opencode.ai/install'))).toBeDefined()
    expect(opencode.platforms.windows!.find(m => m.type === 'binary')).toBeUndefined()
  })

  it('brew install returns correct strings per platform', () => {
    expect(opencode.platforms.macos!.find(m => m.command === 'brew install anomalyco/tap/opencode')).toBeDefined()
    expect(opencode.platforms.linux!.find(m => m.command === 'brew install anomalyco/tap/opencode')).toBeDefined()
    expect(opencode.platforms.windows!.find(m => m.command.includes('brew'))).toBeUndefined()
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

  it('has only bun/npm methods on all platforms', () => {
    for (const methods of Object.values(pi.platforms)) {
      for (const method of methods!) {
        expect(['bun', 'npm']).toContain(method.type)
      }
    }
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
