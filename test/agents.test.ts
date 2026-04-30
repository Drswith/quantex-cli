import type { AgentDefinition } from '../src/agents/types'
import { describe, expect, it } from 'vitest'
import { getAgentByLookupName, getAgentByNameOrAlias, getAllAgents } from '../src/agents'
import { auggie } from '../src/agents/definitions/auggie'
import { claude } from '../src/agents/definitions/claude'
import { codebuddy } from '../src/agents/definitions/codebuddy'
import { codex } from '../src/agents/definitions/codex'
import { copilot } from '../src/agents/definitions/copilot'
import { cursor } from '../src/agents/definitions/cursor'
import { droid } from '../src/agents/definitions/droid'
import { gemini } from '../src/agents/definitions/gemini'
import { junie } from '../src/agents/definitions/junie'
import { kilo } from '../src/agents/definitions/kilo'
import { opencode } from '../src/agents/definitions/opencode'
import { pi } from '../src/agents/definitions/pi'
import { qoder } from '../src/agents/definitions/qoder'
import { qwen } from '../src/agents/definitions/qwen'
import { vibe } from '../src/agents/definitions/vibe'
import { formatInstallMethodCommand } from '../src/utils/install'

describe('agent registry', () => {
  it('returns array with at least 10 agents', () => {
    const agents = getAllAgents()
    expect(agents.length).toBeGreaterThanOrEqual(11)
  })

  it('finds agent by name', () => {
    const agent = getAgentByNameOrAlias('claude')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('claude')
  })

  it('returns undefined for unknown agent', () => {
    expect(getAgentByNameOrAlias('unknown-agent')).toBeUndefined()
  })

  it('finds agent by lookup alias', () => {
    const agent = getAgentByLookupName('agent')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('cursor')
  })
})

function validateAgent(agent: AgentDefinition): void {
  expect(agent.name).toBeTruthy()
  expect(agent.lookupAliases ?? []).toBeInstanceOf(Array)
  expect(agent.displayName).toBeTruthy()
  expect(agent.homepage).toMatch(/^https:\/\//)
  expect(agent.binaryName).toBeTruthy()
  if (agent.selfUpdate) {
    expect(agent.selfUpdate.command.length).toBeGreaterThan(0)
    for (const part of agent.selfUpdate.command) expect(part).toBeTruthy()
    for (const fallback of agent.selfUpdate.fallbackCommands ?? []) {
      expect(fallback.length).toBeGreaterThan(0)
      for (const part of fallback) expect(part).toBeTruthy()
    }
  }
  expect(Object.keys(agent.platforms).length).toBeGreaterThan(0)

  for (const [platform, methods] of Object.entries(agent.platforms)) {
    expect(['windows', 'macos', 'linux']).toContain(platform)
    expect(methods!.length).toBeGreaterThan(0)
    for (const method of methods!) {
      expect(['bun', 'npm', 'brew', 'winget', 'script', 'binary']).toContain(method.type)
      if (method.type === 'script' || method.type === 'binary') {
        expect(typeof method.command).toBe('string')
        expect(method.command.length).toBeGreaterThan(0)
      }
    }
  }
}

describe('auggie', () => {
  it('is registered for lookup by canonical name', () => {
    expect(getAgentByNameOrAlias('auggie')).toBe(auggie)
  })

  it('has valid structure', () => {
    validateAgent(auggie)
    expect(auggie.name).toBe('auggie')
    expect(auggie.lookupAliases).toBeUndefined()
    expect(auggie.displayName).toBe('Auggie CLI')
    expect(auggie.packages?.npm).toBe('@augmentcode/auggie')
    expect(auggie.binaryName).toBe('auggie')
    expect(auggie.homepage).toBe('https://docs.augmentcode.com/cli/overview')
    expect(auggie.selfUpdate?.command).toEqual(['auggie', 'upgrade'])
    expect(auggie.versionProbe?.command).toEqual(['auggie', '--version'])
  })

  it('supports bun and npm installs on macOS and Linux only', () => {
    expect(auggie.platforms.macos!.find(m => m.type === 'bun')).toBeDefined()
    expect(auggie.platforms.macos!.find(m => m.type === 'npm')).toBeDefined()
    expect(auggie.platforms.linux!.find(m => m.type === 'bun')).toBeDefined()
    expect(auggie.platforms.linux!.find(m => m.type === 'npm')).toBeDefined()
    expect(auggie.platforms.windows).toBeUndefined()
  })
})

describe('claude', () => {
  it('has valid structure', () => {
    validateAgent(claude)
    expect(claude.name).toBe('claude')
    expect(claude.displayName).toBe('Claude Code')
    expect(claude.packages?.npm).toBe('@anthropic-ai/claude-code')
    expect(claude.binaryName).toBe('claude')
    expect(claude.selfUpdate?.command).toEqual(['claude', 'update'])
    expect(claude.selfUpdate?.fallbackCommands).toEqual([['claude', 'upgrade']])
  })

  it('curl install returns correct strings per platform', () => {
    expect(
      claude.platforms.windows!.find(m => m.type === 'script' && m.command.includes('claude.ai/install.ps1')),
    ).toBeDefined()
    expect(
      claude.platforms.macos!.find(m => m.type === 'script' && m.command.includes('claude.ai/install.sh')),
    ).toBeDefined()
    expect(
      claude.platforms.linux!.find(m => m.type === 'script' && m.command.includes('claude.ai/install.sh')),
    ).toBeDefined()
  })

  it('package manager install returns correct strings per platform', () => {
    expect(
      claude.platforms.windows!.find(m => m.type === 'winget' && m.packageName === 'Anthropic.ClaudeCode'),
    ).toBeDefined()
    expect(claude.platforms.macos!.find(m => m.type === 'brew' && m.packageName === 'claude-code')).toBeDefined()
    expect(claude.platforms.linux!.find(m => m.type === 'brew' && m.packageName === 'claude-code')).toBeDefined()
  })
})

describe('codex', () => {
  it('has valid structure', () => {
    validateAgent(codex)
    expect(codex.name).toBe('codex')
    expect(codex.displayName).toBe('Codex CLI')
    expect(codex.packages?.npm).toBe('@openai/codex')
    expect(codex.binaryName).toBe('codex')
    expect(codex.homepage).toBe('https://developers.openai.com/codex/cli')
    expect(codex.selfUpdate?.command).toEqual(['codex', '--upgrade'])
  })

  it('binary command returns correct strings per platform', () => {
    expect(codex.platforms.macos!.find(m => m.type === 'brew' && m.packageName === 'codex')).toBeDefined()
    expect(codex.platforms.linux!.find(m => m.type === 'brew' && m.packageName === 'codex')).toBeDefined()
    expect(codex.platforms.windows!.find(m => m.type === 'brew')).toBeUndefined()
  })
})

describe('codebuddy', () => {
  it('is registered for lookup by canonical name', () => {
    expect(getAgentByNameOrAlias('codebuddy')).toBe(codebuddy)
  })

  it('is registered for lookup by package-style alias', () => {
    expect(getAgentByNameOrAlias('codebuddy-code')).toBe(codebuddy)
  })

  it('has valid structure', () => {
    validateAgent(codebuddy)
    expect(codebuddy.name).toBe('codebuddy')
    expect(codebuddy.lookupAliases).toEqual(['codebuddy-code'])
    expect(codebuddy.displayName).toBe('CodeBuddy Code')
    expect(codebuddy.packages?.npm).toBe('@tencent-ai/codebuddy-code')
    expect(codebuddy.binaryName).toBe('codebuddy')
    expect(codebuddy.homepage).toBe('https://www.codebuddy.cn/docs/cli/installation')
    expect(codebuddy.selfUpdate?.command).toEqual(['codebuddy', 'update'])
    expect(codebuddy.versionProbe?.command).toEqual(['codebuddy', '--version'])
  })

  it('script install returns correct strings per platform', () => {
    expect(
      codebuddy.platforms.windows!.find(m => m.type === 'script' && m.command.includes('codebuddy.cn/cli/install.ps1')),
    ).toBeDefined()
    expect(
      codebuddy.platforms.macos!.find(m => m.type === 'script' && m.command.includes('codebuddy.cn/cli/install.sh')),
    ).toBeDefined()
    expect(
      codebuddy.platforms.linux!.find(m => m.type === 'script' && m.command.includes('codebuddy.cn/cli/install.sh')),
    ).toBeDefined()
  })

  it('brew install returns correct strings per platform', () => {
    expect(
      codebuddy.platforms.macos!.find(
        m => m.type === 'brew' && m.packageName === 'Tencent-CodeBuddy/tap/codebuddy-code',
      ),
    ).toBeDefined()
    expect(
      codebuddy.platforms.linux!.find(
        m => m.type === 'brew' && m.packageName === 'Tencent-CodeBuddy/tap/codebuddy-code',
      ),
    ).toBeDefined()
    expect(codebuddy.platforms.windows!.find(m => m.type === 'brew')).toBeUndefined()
  })
})

describe('copilot', () => {
  it('has valid structure', () => {
    validateAgent(copilot)
    expect(copilot.name).toBe('copilot')
    expect(copilot.displayName).toBe('GitHub Copilot CLI')
    expect(copilot.packages?.npm).toBe('@github/copilot')
    expect(copilot.binaryName).toBe('copilot')
    expect(copilot.lookupAliases).toBeUndefined()
  })

  it('script install returns correct strings per platform', () => {
    expect(
      copilot.platforms.windows!.find(m => m.type === 'winget' && m.packageName === 'GitHub.Copilot'),
    ).toBeDefined()
    expect(copilot.platforms.macos!.find(m => m.type === 'script' && m.command.includes('curl'))).toBeDefined()
    expect(copilot.platforms.linux!.find(m => m.type === 'script' && m.command.includes('curl'))).toBeDefined()
  })

  it('brew install returns correct strings per platform', () => {
    expect(copilot.platforms.macos!.find(m => m.type === 'brew' && m.packageName === 'copilot-cli')).toBeDefined()
    expect(copilot.platforms.linux!.find(m => m.type === 'brew' && m.packageName === 'copilot-cli')).toBeDefined()
    expect(copilot.platforms.windows!.find(m => m.type === 'brew')).toBeUndefined()
  })
})

describe('cursor', () => {
  it('has valid structure', () => {
    validateAgent(cursor)
    expect(cursor.name).toBe('cursor')
    expect(cursor.displayName).toBe('Cursor CLI')
    expect(cursor.binaryName).toBe('agent')
    expect(cursor.selfUpdate?.command).toEqual(['agent', 'update'])
    expect(cursor.versionProbe?.command).toEqual(['agent', '--version'])
  })

  it('binary install returns correct strings per platform', () => {
    expect(cursor.platforms.macos!.find(m => (m.command ?? '').includes('cursor.com/install'))).toBeDefined()
    expect(cursor.platforms.linux!.find(m => (m.command ?? '').includes('cursor.com/install'))).toBeDefined()
    expect(cursor.platforms.windows!.find(m => (m.command ?? '').includes('cursor.com/install'))).toBeDefined()
  })
})

describe('droid', () => {
  it('has valid structure', () => {
    validateAgent(droid)
    expect(droid.name).toBe('droid')
    expect(droid.displayName).toBe('Droid')
    expect(droid.packages?.npm).toBe('droid')
    expect(droid.binaryName).toBe('droid')
    expect(droid.selfUpdate?.command).toEqual(['droid', 'update'])
  })

  it('curl install returns correct strings per platform', () => {
    expect(droid.platforms.windows!.find(m => m.type === 'script' && m.command.includes('irm'))).toBeDefined()
    expect(
      droid.platforms.macos!.find(m => m.type === 'script' && m.command.includes('app.factory.ai/cli')),
    ).toBeDefined()
    expect(
      droid.platforms.linux!.find(m => m.type === 'script' && m.command.includes('app.factory.ai/cli')),
    ).toBeDefined()
  })

  it('brew install returns correct strings per platform', () => {
    expect(
      droid.platforms.macos!.find(
        m => m.type === 'brew' && m.packageName === 'droid' && m.packageTargetKind === 'cask',
      ),
    ).toBeDefined()
    expect(
      droid.platforms.linux!.find(
        m => m.type === 'brew' && m.packageName === 'droid' && m.packageTargetKind === 'cask',
      ),
    ).toBeDefined()
    expect(droid.platforms.windows!.find(m => m.type === 'brew')).toBeUndefined()
  })
})

describe('gemini', () => {
  it('has valid structure', () => {
    validateAgent(gemini)
    expect(gemini.name).toBe('gemini')
    expect(gemini.displayName).toBe('Gemini CLI')
    expect(gemini.packages?.npm).toBe('@google/gemini-cli')
    expect(gemini.binaryName).toBe('gemini')
    expect(gemini.homepage).toBe('https://google-gemini.github.io/gemini-cli/docs/')
    expect(gemini.lookupAliases).toBeUndefined()
  })

  it('brew install returns correct strings per platform', () => {
    expect(gemini.platforms.macos!.find(m => m.type === 'brew' && m.packageName === 'gemini-cli')).toBeDefined()
    expect(gemini.platforms.linux!.find(m => m.type === 'brew' && m.packageName === 'gemini-cli')).toBeDefined()
    expect(gemini.platforms.windows!.find(m => m.type === 'brew')).toBeUndefined()
  })
})

describe('junie', () => {
  it('has valid structure', () => {
    validateAgent(junie)
    expect(junie.name).toBe('junie')
    expect(junie.lookupAliases).toBeUndefined()
    expect(junie.displayName).toBe('Junie CLI')
    expect(junie.packages?.npm).toBe('@jetbrains/junie')
    expect(junie.binaryName).toBe('junie')
    expect(junie.homepage).toBe('https://junie.jetbrains.com/docs/junie-cli.html')
    expect(junie.selfUpdate).toBeUndefined()
    expect(junie.versionProbe?.command).toEqual(['junie', '--version'])
  })

  it('supports managed installs on all platforms plus official script and brew paths', () => {
    expect(junie.platforms.windows!.find(m => m.type === 'bun')).toBeDefined()
    expect(junie.platforms.windows!.find(m => m.type === 'npm')).toBeDefined()
    expect(
      junie.platforms.windows!.find(m => m.type === 'script' && m.command.includes('junie.jetbrains.com/install.ps1')),
    ).toBeDefined()

    expect(
      junie.platforms.macos!.find(m => m.type === 'script' && m.command.includes('junie.jetbrains.com/install.sh')),
    ).toBeDefined()
    expect(
      junie.platforms.linux!.find(m => m.type === 'script' && m.command.includes('junie.jetbrains.com/install.sh')),
    ).toBeDefined()
    expect(
      junie.platforms.macos!.find(m => m.type === 'brew' && m.packageName === 'jetbrains-junie/junie/junie'),
    ).toBeDefined()
    expect(
      junie.platforms.linux!.find(m => m.type === 'brew' && m.packageName === 'jetbrains-junie/junie/junie'),
    ).toBeDefined()
  })
})

describe('opencode', () => {
  it('has valid structure', () => {
    validateAgent(opencode)
    expect(opencode.name).toBe('opencode')
    expect(opencode.displayName).toBe('OpenCode')
    expect(opencode.packages?.npm).toBe('opencode-ai')
    expect(opencode.binaryName).toBe('opencode')
    expect(opencode.selfUpdate?.command).toEqual(['opencode', 'upgrade'])
  })

  it('curl install returns correct strings per platform', () => {
    expect(
      opencode.platforms.macos!.find(m => m.type === 'script' && m.command.includes('opencode.ai/install')),
    ).toBeDefined()
    expect(
      opencode.platforms.linux!.find(m => m.type === 'script' && m.command.includes('opencode.ai/install')),
    ).toBeDefined()
    expect(opencode.platforms.windows!.find(m => m.type === 'script')).toBeUndefined()
  })

  it('brew install returns correct strings per platform', () => {
    expect(
      opencode.platforms.macos!.find(m => m.type === 'brew' && m.packageName === 'anomalyco/tap/opencode'),
    ).toBeDefined()
    expect(
      opencode.platforms.linux!.find(m => m.type === 'brew' && m.packageName === 'anomalyco/tap/opencode'),
    ).toBeDefined()
    expect(opencode.platforms.windows!.find(m => m.type === 'brew')).toBeUndefined()
  })
})

describe('kilo', () => {
  it('has valid structure', () => {
    validateAgent(kilo)
    expect(kilo.name).toBe('kilo')
    expect(kilo.lookupAliases).toBeUndefined()
    expect(kilo.displayName).toBe('Kilo CLI')
    expect(kilo.packages?.npm).toBe('@kilocode/cli')
    expect(kilo.binaryName).toBe('kilo')
    expect(kilo.homepage).toBe('https://kilo.ai/docs/cli')
    expect(kilo.selfUpdate?.command).toEqual(['kilo', 'upgrade'])
  })

  it('has only bun/npm methods on all platforms', () => {
    for (const methods of Object.values(kilo.platforms)) {
      for (const method of methods!) {
        expect(['bun', 'npm']).toContain(method.type)
      }
    }
  })
})

describe('pi', () => {
  it('has valid structure', () => {
    validateAgent(pi)
    expect(pi.name).toBe('pi')
    expect(pi.displayName).toBe('Pi')
    expect(pi.packages?.npm).toBe('@mariozechner/pi-coding-agent')
    expect(pi.binaryName).toBe('pi')
    expect(pi.selfUpdate?.command).toEqual(['pi', 'update'])
  })

  it('has only bun/npm methods on all platforms', () => {
    for (const methods of Object.values(pi.platforms)) {
      for (const method of methods!) {
        expect(['bun', 'npm']).toContain(method.type)
      }
    }
  })
})

describe('qoder', () => {
  it('is registered for lookup by canonical name', () => {
    expect(getAgentByNameOrAlias('qoder')).toBe(qoder)
  })

  it('is registered for lookup by executable alias', () => {
    expect(getAgentByNameOrAlias('qodercli')).toBe(qoder)
  })

  it('has valid structure', () => {
    validateAgent(qoder)
    expect(qoder.name).toBe('qoder')
    expect(qoder.displayName).toBe('Qoder CLI')
    expect(qoder.packages?.npm).toBe('@qoder-ai/qodercli')
    expect(qoder.binaryName).toBe('qodercli')
    expect(qoder.homepage).toBe('https://docs.qoder.com/cli/quick-start')
    expect(qoder.selfUpdate?.command).toEqual(['qodercli', 'update'])
  })

  it('curl install returns correct strings per platform', () => {
    expect(
      qoder.platforms.macos!.find(m => m.type === 'script' && m.command.includes('qoder.com/install')),
    ).toBeDefined()
    expect(
      qoder.platforms.linux!.find(m => m.type === 'script' && m.command.includes('qoder.com/install')),
    ).toBeDefined()
    expect(qoder.platforms.windows!.find(m => m.type === 'script')).toBeUndefined()
  })

  it('brew install returns correct strings per platform', () => {
    expect(
      qoder.platforms.macos!.find(
        m => m.type === 'brew' && m.packageName === 'qoderai/qoder/qodercli' && m.packageTargetKind === 'cask',
      ),
    ).toBeDefined()
    expect(
      qoder.platforms.linux!.find(
        m => m.type === 'brew' && m.packageName === 'qoderai/qoder/qodercli' && m.packageTargetKind === 'cask',
      ),
    ).toBeDefined()
    expect(qoder.platforms.windows!.find(m => m.type === 'brew')).toBeUndefined()
  })

  it('uses qodercli as the executable binary while keeping qoder as the slug', () => {
    expect(qoder.name).toBe('qoder')
    expect(qoder.binaryName).toBe('qodercli')
  })
})

describe('qwen', () => {
  it('is registered for lookup by canonical name', () => {
    expect(getAgentByNameOrAlias('qwen')).toBe(qwen)
    expect(getAgentByNameOrAlias('qwen-code')).toBeUndefined()
  })

  it('has valid structure', () => {
    validateAgent(qwen)
    expect(qwen.name).toBe('qwen')
    expect(qwen.lookupAliases).toBeUndefined()
    expect(qwen.displayName).toBe('Qwen Code')
    expect(qwen.packages?.npm).toBe('@qwen-code/qwen-code')
    expect(qwen.binaryName).toBe('qwen')
    expect(qwen.homepage).toBe('https://qwenlm.github.io/qwen-code-docs/')
  })

  it('script install returns correct strings per platform', () => {
    expect(
      qwen.platforms.macos!.find(
        m => m.type === 'script' && m.command.includes('qwen-code-assets.oss-cn-hangzhou.aliyuncs.com'),
      ),
    ).toBeDefined()
    expect(
      qwen.platforms.linux!.find(
        m => m.type === 'script' && m.command.includes('qwen-code-assets.oss-cn-hangzhou.aliyuncs.com'),
      ),
    ).toBeDefined()
    expect(
      qwen.platforms.windows!.find(
        m => m.type === 'script' && m.command.includes('qwen-code-assets.oss-cn-hangzhou.aliyuncs.com'),
      ),
    ).toBeDefined()
  })

  it('brew install returns correct strings per platform', () => {
    expect(qwen.platforms.macos!.find(m => m.type === 'brew' && m.packageName === 'qwen-code')).toBeDefined()
    expect(qwen.platforms.linux!.find(m => m.type === 'brew' && m.packageName === 'qwen-code')).toBeDefined()
    expect(qwen.platforms.windows!.find(m => m.type === 'brew')).toBeUndefined()
  })
})

describe('vibe', () => {
  it('is registered for lookup by canonical name and package alias', () => {
    expect(getAgentByNameOrAlias('vibe')).toBe(vibe)
    expect(getAgentByNameOrAlias('mistral-vibe')).toBe(vibe)
  })

  it('has valid structure', () => {
    validateAgent(vibe)
    expect(vibe.name).toBe('vibe')
    expect(vibe.lookupAliases).toEqual(['mistral-vibe'])
    expect(vibe.displayName).toBe('Mistral Vibe')
    expect(vibe.binaryName).toBe('vibe')
    expect(vibe.homepage).toBe('https://docs.mistral.ai/mistral-vibe/terminal/install')
    expect(vibe.versionProbe?.command).toEqual(['vibe', '--version'])
    expect(vibe.selfUpdate).toBeUndefined()
  })

  it('exposes official install methods per platform', () => {
    expect(
      vibe.platforms.macos!.find(m => m.type === 'script' && m.command.includes('https://mistral.ai/vibe/install.sh')),
    ).toBeDefined()
    expect(
      vibe.platforms.linux!.find(m => m.type === 'script' && m.command.includes('https://mistral.ai/vibe/install.sh')),
    ).toBeDefined()

    for (const methods of Object.values(vibe.platforms)) {
      expect(methods!.find(m => m.type === 'binary' && m.command === 'uv tool install mistral-vibe')).toBeDefined()
      expect(methods!.find(m => m.type === 'binary' && m.command === 'pip install mistral-vibe')).toBeDefined()
    }

    expect(vibe.platforms.windows!.find(m => m.type === 'script')).toBeUndefined()
  })
})

describe('install command formatting', () => {
  it('renders managed install commands from structured methods', () => {
    expect(formatInstallMethodCommand(codex, codex.platforms.macos![0]!)).toBe('bun add -g @openai/codex')
    expect(formatInstallMethodCommand(codex, codex.platforms.macos![2]!)).toBe('brew install codex')
    expect(formatInstallMethodCommand(claude, claude.platforms.macos![3]!)).toBe('brew install --cask claude-code')
  })
})

describe('agent identifiers', () => {
  it('has no duplicate names or lookup aliases across agents', () => {
    const agents = getAllAgents()
    const seen = new Map<string, string>()
    for (const agent of agents) {
      const identifiers = [agent.name, ...(agent.lookupAliases ?? [])]
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

  it('lookup aliases do not repeat the canonical name', () => {
    for (const agent of getAllAgents()) {
      expect(agent.lookupAliases ?? []).not.toContain(agent.name)
    }
  })

  it('displayNames are not all lowercase', () => {
    for (const agent of getAllAgents()) {
      expect(agent.displayName).not.toBe(agent.displayName.toLowerCase())
    }
  })
})
