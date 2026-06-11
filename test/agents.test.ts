import type { AgentDefinition } from '../src/agents/types'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildAgentCatalogManifest, readCatalogEntries } from '../scripts/write-agent-catalog-manifest'
import * as agentExports from '../src/agents'
import {
  auggie,
  autohand,
  claude,
  codebuddy,
  codewhale,
  codex,
  copilot,
  cursor,
  deepcode,
  devin,
  droid,
  gemini,
  getAgentByLookupName,
  getAgentByNameOrAlias,
  getAllAgents,
  jcode,
  junie,
  kilo,
  kimi,
  mimo,
  omp,
  opencode,
  openhands,
  pi,
  qoder,
  qwen,
  reasonix,
  vibe,
  vtcode,
} from '../src/agents'
import catalogSchemaFile from '../src/agents/catalog.schema.json'
import { catalogData } from '../src/agents/generated/catalog-data'
import { agentCatalogJsonSchema, agentCatalogSchema } from '../src/agents/schema'
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
      expect(['bun', 'npm', 'brew', 'cargo', 'deno', 'mise', 'pip', 'uv', 'winget', 'script', 'binary']).toContain(
        method.type,
      )
      if (method.type === 'script' || method.type === 'binary') {
        expect(typeof method.command).toBe('string')
        expect(method.command.length).toBeGreaterThan(0)
      }
    }
  }
}

describe('agent catalog data schema', () => {
  it('validates the checked-in catalog data', () => {
    const parsed = agentCatalogSchema.parse(catalogData)

    expect(parsed.map(agent => agent.name)).toEqual(getAllAgents().map(agent => agent.name))
  })

  it('rejects invalid catalog data before runtime use', () => {
    const invalidCatalog = [
      {
        ...catalogData[0],
        platforms: {
          plan9: [{ type: 'npm' }],
        },
      },
    ]

    expect(() => agentCatalogSchema.parse(invalidCatalog)).toThrow()
  })

  it('keeps the checked-in JSON Schema in sync with the Zod contract', () => {
    expect(catalogSchemaFile).toEqual(agentCatalogJsonSchema)
  })

  it('keeps the checked-in catalog manifest in sync with the catalog directory', async () => {
    const manifest = await buildAgentCatalogManifest()
    const catalogDataSource = await readFile(
      new URL('../src/agents/generated/catalog-data.ts', import.meta.url),
      'utf8',
    )
    const catalogAgentsSource = await readFile(
      new URL('../src/agents/generated/catalog-agents.ts', import.meta.url),
      'utf8',
    )

    expect(catalogDataSource).toBe(manifest.catalogDataSource)
    expect(catalogAgentsSource).toBe(manifest.catalogAgentsSource)
  })

  it('rejects catalog files whose filename does not match the entry name', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'quantex-agent-catalog-'))

    try {
      await writeFile(join(tempDir, 'claude.json'), JSON.stringify({ name: 'codex' }))

      await expect(readCatalogEntries(tempDir)).rejects.toThrow(
        'Catalog filename claude.json must match entry name codex.',
      )
    } finally {
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('exports every catalog agent by canonical name from the agents module', () => {
    for (const agent of getAllAgents()) {
      expect(agentExports[agent.name as keyof typeof agentExports]).toBe(agent)
    }
  })
})

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

describe('autohand', () => {
  it('is registered for lookup by canonical name and package-style alias', () => {
    expect(getAgentByNameOrAlias('autohand')).toBe(autohand)
    expect(getAgentByLookupName('autohand-cli')).toBe(autohand)
  })

  it('has valid structure', () => {
    validateAgent(autohand)
    expect(autohand.name).toBe('autohand')
    expect(autohand.lookupAliases).toEqual(['autohand-cli'])
    expect(autohand.displayName).toBe('Autohand Code CLI')
    expect(autohand.packages?.npm).toBe('autohand-cli')
    expect(autohand.binaryName).toBe('autohand')
    expect(autohand.homepage).toBe('https://autohand.ai/cli/')
    expect(autohand.selfUpdate).toBeUndefined()
    expect(autohand.versionProbe?.command).toEqual(['autohand', '--version'])
  })

  it('supports official script installers on all platforms', () => {
    expect(
      autohand.platforms.windows!.find(m => m.type === 'script' && m.command.includes('autohand.ai/install.ps1')),
    ).toBeDefined()
    expect(
      autohand.platforms.macos!.find(m => m.type === 'script' && m.command.includes('autohand.ai/install.sh')),
    ).toBeDefined()
    expect(
      autohand.platforms.linux!.find(m => m.type === 'script' && m.command.includes('autohand.ai/install.sh')),
    ).toBeDefined()
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
    expect(codex.packages?.mise).toBe('npm:@openai/codex')
    expect(codex.packages?.npm).toBe('@openai/codex')
    expect(codex.binaryName).toBe('codex')
    expect(codex.homepage).toBe('https://developers.openai.com/codex/cli')
    expect(codex.selfUpdate?.command).toEqual(['codex', '--upgrade'])
  })

  it('binary command returns correct strings per platform', () => {
    expect(codex.platforms.macos!.find(m => m.type === 'brew' && m.packageName === 'codex')).toBeDefined()
    expect(codex.platforms.linux!.find(m => m.type === 'brew' && m.packageName === 'codex')).toBeDefined()
    expect(codex.platforms.windows!.find(m => m.type === 'mise')).toBeDefined()
    expect(codex.platforms.macos!.find(m => m.type === 'mise')).toBeDefined()
    expect(codex.platforms.linux!.find(m => m.type === 'mise')).toBeDefined()
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

describe('reasonix', () => {
  it('is registered for lookup by canonical name and repository-style alias', () => {
    expect(getAgentByNameOrAlias('reasonix')).toBe(reasonix)
    expect(getAgentByLookupName('deepseek-reasonix')).toBe(reasonix)
  })

  it('has valid structure', () => {
    validateAgent(reasonix)
    expect(reasonix.name).toBe('reasonix')
    expect(reasonix.lookupAliases).toEqual(['deepseek-reasonix'])
    expect(reasonix.displayName).toBe('Reasonix')
    expect(reasonix.packages?.npm).toBe('reasonix')
    expect(reasonix.binaryName).toBe('reasonix')
    expect(reasonix.homepage).toBe('https://github.com/esengine/DeepSeek-Reasonix')
    expect(reasonix.selfUpdate?.command).toEqual(['reasonix', 'update'])
    expect(reasonix.versionProbe?.command).toEqual(['reasonix', '--version'])
  })

  it('supports npm installs on all platforms', () => {
    expect(reasonix.platforms.windows!.find(m => m.type === 'npm')).toBeDefined()
    expect(reasonix.platforms.macos!.find(m => m.type === 'npm')).toBeDefined()
    expect(reasonix.platforms.linux!.find(m => m.type === 'npm')).toBeDefined()
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

describe('devin', () => {
  it('is registered for lookup by canonical name', () => {
    expect(getAgentByNameOrAlias('devin')).toBe(devin)
  })

  it('has valid structure', () => {
    validateAgent(devin)
    expect(devin.name).toBe('devin')
    expect(devin.lookupAliases).toBeUndefined()
    expect(devin.displayName).toBe('Devin for Terminal')
    expect(devin.binaryName).toBe('devin')
    expect(devin.homepage).toBe('https://cli.devin.ai/')
    expect(devin.selfUpdate?.command).toEqual(['devin', 'update'])
    expect(devin.versionProbe?.command).toEqual(['devin', 'version'])
  })

  it('exposes the official script installers per platform', () => {
    expect(
      devin.platforms.windows!.find(m => m.type === 'script' && m.command.includes('static.devin.ai/cli/setup.ps1')),
    ).toBeDefined()
    expect(
      devin.platforms.macos!.find(m => m.type === 'script' && m.command.includes('cli.devin.ai/install.sh')),
    ).toBeDefined()
    expect(
      devin.platforms.linux!.find(m => m.type === 'script' && m.command.includes('cli.devin.ai/install.sh')),
    ).toBeDefined()
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

describe('codewhale', () => {
  it('is registered for lookup by canonical name only', () => {
    expect(getAgentByNameOrAlias('codewhale')).toBe(codewhale)
    expect(getAgentByNameOrAlias('deepseek')).toBeUndefined()
    expect(getAgentByNameOrAlias('deepseek-tui')).toBeUndefined()
  })

  it('has valid structure', () => {
    validateAgent(codewhale)
    expect(codewhale.name).toBe('codewhale')
    expect(codewhale.lookupAliases).toBeUndefined()
    expect(codewhale.displayName).toBe('CodeWhale')
    expect(codewhale.packages?.cargo).toBe('codewhale-cli')
    expect(codewhale.packages?.npm).toBe('codewhale')
    expect(codewhale.binaryName).toBe('codewhale')
    expect(codewhale.homepage).toBe('https://github.com/Hmbown/CodeWhale')
    expect(codewhale.selfUpdate?.command).toEqual(['codewhale', 'update'])
    expect(codewhale.versionProbe?.command).toEqual(['codewhale', '--version'])
  })

  it('exposes npm install on all supported platforms', () => {
    expect(codewhale.platforms.windows!.find(m => m.type === 'npm')).toBeDefined()
    expect(codewhale.platforms.macos!.find(m => m.type === 'npm')).toBeDefined()
    expect(codewhale.platforms.linux!.find(m => m.type === 'npm')).toBeDefined()
  })

  it('exposes locked cargo install on all supported platforms', () => {
    for (const methods of [codewhale.platforms.windows!, codewhale.platforms.macos!, codewhale.platforms.linux!]) {
      expect(
        methods.find(
          method =>
            method.type === 'cargo' &&
            method.packageName === undefined &&
            method.packageInstallArgs?.join(' ') === '--locked',
        ),
      ).toBeDefined()
    }
  })
})

describe('deepcode', () => {
  it('is registered for lookup by canonical name', () => {
    expect(getAgentByNameOrAlias('deepcode')).toBe(deepcode)
  })

  it('has valid structure', () => {
    validateAgent(deepcode)
    expect(deepcode.name).toBe('deepcode')
    expect(deepcode.displayName).toBe('Deep Code CLI')
    expect(deepcode.packages?.npm).toBe('@vegamo/deepcode-cli')
    expect(deepcode.binaryName).toBe('deepcode')
    expect(deepcode.homepage).toBe('https://github.com/lessweb/deepcode-cli')
    expect(deepcode.selfUpdate).toBeUndefined()
    expect(deepcode.versionProbe?.command).toEqual(['deepcode', '--version'])
  })

  it('exposes npm install on all supported platforms', () => {
    expect(deepcode.platforms.windows!.find(m => m.type === 'npm')).toBeDefined()
    expect(deepcode.platforms.macos!.find(m => m.type === 'npm')).toBeDefined()
    expect(deepcode.platforms.linux!.find(m => m.type === 'npm')).toBeDefined()
  })
})

describe('jcode', () => {
  it('is registered for lookup by canonical name', () => {
    expect(getAgentByNameOrAlias('jcode')).toBe(jcode)
  })

  it('has valid structure', () => {
    validateAgent(jcode)
    expect(jcode.name).toBe('jcode')
    expect(jcode.lookupAliases).toBeUndefined()
    expect(jcode.displayName).toBe('JCode')
    expect(jcode.packages).toBeUndefined()
    expect(jcode.binaryName).toBe('jcode')
    expect(jcode.homepage).toBe('https://github.com/1jehuang/jcode')
    expect(jcode.selfUpdate).toBeUndefined()
    expect(jcode.versionProbe?.command).toEqual(['jcode', '--version'])
  })

  it('supports official Homebrew and script installers without inventing update metadata', () => {
    expect(jcode.platforms.windows).toEqual([
      {
        command: 'irm https://raw.githubusercontent.com/1jehuang/jcode/master/scripts/install.ps1 | iex',
        type: 'script',
      },
    ])
    expect(
      jcode.platforms.macos!.find(m => m.type === 'brew' && m.packageName === '1jehuang/jcode/jcode'),
    ).toBeDefined()
    expect(
      jcode.platforms.macos!.find(
        m =>
          m.type === 'script' &&
          m.command.includes('raw.githubusercontent.com/1jehuang/jcode/master/scripts/install.sh'),
      ),
    ).toBeDefined()
    expect(
      jcode.platforms.linux!.find(
        m =>
          m.type === 'script' &&
          m.command.includes('raw.githubusercontent.com/1jehuang/jcode/master/scripts/install.sh'),
      ),
    ).toBeDefined()
    expect(jcode.selfUpdate).toBeUndefined()
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

describe('openhands', () => {
  it('is registered for lookup by canonical name', () => {
    expect(getAgentByNameOrAlias('openhands')).toBe(openhands)
  })

  it('has valid structure', () => {
    validateAgent(openhands)
    expect(openhands.name).toBe('openhands')
    expect(openhands.lookupAliases).toBeUndefined()
    expect(openhands.displayName).toBe('OpenHands CLI')
    expect(openhands.binaryName).toBe('openhands')
    expect(openhands.packages?.uv).toBe('openhands')
    expect(openhands.homepage).toBe('https://docs.openhands.dev/openhands/usage/cli/installation')
    expect(openhands.selfUpdate?.command).toEqual(['uv', 'tool', 'upgrade', 'openhands', '--python', '3.12'])
    expect(openhands.versionProbe?.command).toEqual(['openhands', '--version'])
  })

  it('supports official uv and install-script methods on macOS and Linux only', () => {
    for (const methods of [openhands.platforms.macos, openhands.platforms.linux]) {
      expect(
        methods!.find(
          m => m.type === 'uv' && m.packageName === undefined && m.packageInstallArgs?.join(' ') === '--python 3.12',
        ),
      ).toBeDefined()
      expect(
        methods!.find(
          m => m.type === 'script' && m.command === 'curl -fsSL https://install.openhands.dev/install.sh | sh',
        ),
      ).toBeDefined()
    }

    expect(openhands.platforms.windows).toBeUndefined()
  })
})

describe('kimi', () => {
  it('is registered for lookup by canonical name and aliases', () => {
    expect(getAgentByNameOrAlias('kimi')).toBe(kimi)
    expect(getAgentByLookupName('kimi-code')).toBe(kimi)
    expect(getAgentByLookupName('kimi-cli')).toBe(kimi)
  })

  it('has valid structure', () => {
    validateAgent(kimi)
    expect(kimi.name).toBe('kimi')
    expect(kimi.lookupAliases).toEqual(['kimi-code', 'kimi-cli'])
    expect(kimi.displayName).toBe('Kimi Code')
    expect(kimi.binaryName).toBe('kimi')
    expect(kimi.packages?.npm).toBe('@moonshot-ai/kimi-code')
    expect(kimi.packages?.uv).toBeUndefined()
    expect(kimi.homepage).toBe('https://moonshotai.github.io/kimi-code/')
    expect(kimi.selfUpdate?.command).toEqual(['kimi', 'upgrade'])
    expect(kimi.versionProbe?.command).toEqual(['kimi', '--version'])
  })

  it('exposes official script installers and npm-managed installs on all platforms', () => {
    for (const methods of [kimi.platforms.windows!, kimi.platforms.macos!, kimi.platforms.linux!]) {
      expect(methods.find(m => m.type === 'uv')).toBeUndefined()
      expect(methods.find(m => m.type === 'npm')).toBeDefined()
    }

    expect(
      kimi.platforms.windows!.find(
        m => m.type === 'script' && m.command === 'irm https://code.kimi.com/kimi-code/install.ps1 | iex',
      ),
    ).toBeDefined()
    expect(
      kimi.platforms.macos!.find(
        m => m.type === 'script' && m.command === 'curl -fsSL https://code.kimi.com/kimi-code/install.sh | bash',
      ),
    ).toBeDefined()
    expect(
      kimi.platforms.linux!.find(
        m => m.type === 'script' && m.command === 'curl -fsSL https://code.kimi.com/kimi-code/install.sh | bash',
      ),
    ).toBeDefined()
  })
})

describe('mimo', () => {
  it('is registered for lookup by canonical name and aliases', () => {
    expect(getAgentByNameOrAlias('mimo')).toBe(mimo)
    expect(getAgentByLookupName('mimocode')).toBe(mimo)
    expect(getAgentByLookupName('mimo-code')).toBe(mimo)
  })

  it('has valid structure', () => {
    validateAgent(mimo)
    expect(mimo.name).toBe('mimo')
    expect(mimo.lookupAliases).toEqual(['mimocode', 'mimo-code'])
    expect(mimo.displayName).toBe('MiMoCode')
    expect(mimo.binaryName).toBe('mimo')
    expect(mimo.packages?.npm).toBe('@mimo-ai/cli')
    expect(mimo.homepage).toBe('https://github.com/XiaomiMiMo/MiMo-Code')
    expect(mimo.selfUpdate).toBeUndefined()
    expect(mimo.versionProbe?.command).toEqual(['mimo', '--version'])
  })

  it('exposes official script installers and npm-managed installs on supported platforms', () => {
    for (const methods of [mimo.platforms.windows!, mimo.platforms.macos!, mimo.platforms.linux!]) {
      expect(methods.find(m => m.type === 'npm')).toBeDefined()
    }

    expect(mimo.platforms.windows!.find(m => m.type === 'script')).toBeUndefined()
    expect(
      mimo.platforms.macos!.find(
        m => m.type === 'script' && m.command === 'curl -fsSL https://mimo.xiaomi.com/install | bash',
      ),
    ).toBeDefined()
    expect(
      mimo.platforms.linux!.find(
        m => m.type === 'script' && m.command === 'curl -fsSL https://mimo.xiaomi.com/install | bash',
      ),
    ).toBeDefined()
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

describe('omp', () => {
  it('is registered for lookup by canonical name', () => {
    expect(getAgentByNameOrAlias('omp')).toBe(omp)
  })

  it('has valid structure', () => {
    validateAgent(omp)
    expect(omp.name).toBe('omp')
    expect(omp.lookupAliases).toBeUndefined()
    expect(omp.displayName).toBe('oh-my-pi (OMP)')
    expect(omp.packages?.npm).toBe('@oh-my-pi/pi-coding-agent')
    expect(omp.binaryName).toBe('omp')
    expect(omp.homepage).toBe('https://github.com/can1357/oh-my-pi')
    expect(omp.versionProbe?.command).toEqual(['omp', '--version'])
    expect(omp.selfUpdate).toBeUndefined()
  })

  it('supports managed bun and official script installs on all platforms', () => {
    for (const methods of Object.values(omp.platforms)) {
      expect(methods!.find(m => m.type === 'bun')).toBeDefined()
    }

    expect(
      omp.platforms.windows!.find(m => m.type === 'script' && m.command.includes('https://omp.sh/install.ps1')),
    ).toBeDefined()
    expect(
      omp.platforms.macos!.find(m => m.type === 'script' && m.command.includes('https://omp.sh/install')),
    ).toBeDefined()
    expect(
      omp.platforms.linux!.find(m => m.type === 'script' && m.command.includes('https://omp.sh/install')),
    ).toBeDefined()
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
    expect(vibe.packages?.pip).toBe('mistral-vibe')
    expect(vibe.packages?.uv).toBe('mistral-vibe')
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
      expect(methods!.find(m => m.type === 'uv' && m.packageName === 'mistral-vibe')).toBeDefined()
      expect(methods!.find(m => m.type === 'pip' && m.packageName === 'mistral-vibe')).toBeDefined()
    }

    expect(vibe.platforms.windows!.find(m => m.type === 'script')).toBeUndefined()
  })
})

describe('vtcode', () => {
  it('is registered for lookup by canonical name', () => {
    expect(getAgentByNameOrAlias('vtcode')).toBe(vtcode)
  })

  it('has valid structure', () => {
    validateAgent(vtcode)
    expect(vtcode.name).toBe('vtcode')
    expect(vtcode.lookupAliases).toBeUndefined()
    expect(vtcode.displayName).toBe('VTCode')
    expect(vtcode.packages?.cargo).toBe('vtcode')
    expect(vtcode.binaryName).toBe('vtcode')
    expect(vtcode.homepage).toBe('https://github.com/vinhnx/vtcode')
    expect(vtcode.selfUpdate?.command).toEqual(['vtcode', 'update'])
    expect(vtcode.versionProbe?.command).toEqual(['vtcode', '--version'])
  })

  it('exposes official install methods per platform', () => {
    expect(vtcode.platforms.windows!.map(m => m.type)).toEqual(['cargo', 'script'])
    expect(
      vtcode.platforms.windows!.find(
        m =>
          m.type === 'script' && m.command.includes('raw.githubusercontent.com/vinhnx/vtcode/main/scripts/install.ps1'),
      ),
    ).toBeDefined()

    for (const methods of [vtcode.platforms.windows!, vtcode.platforms.macos!, vtcode.platforms.linux!]) {
      expect(methods.find(m => m.type === 'cargo')).toBeDefined()
    }

    for (const methods of [vtcode.platforms.macos!, vtcode.platforms.linux!]) {
      expect(
        methods.find(
          m =>
            m.type === 'script' &&
            m.command.includes('raw.githubusercontent.com/vinhnx/vtcode/main/scripts/install.sh'),
        ),
      ).toBeDefined()
      expect(methods.find(m => m.type === 'brew' && m.packageName === 'vtcode')).toBeDefined()
    }

    expect(vtcode.platforms.windows!.find(m => m.type === 'brew')).toBeUndefined()
  })
})

describe('install command formatting', () => {
  it('renders managed install commands from structured methods', () => {
    expect(formatInstallMethodCommand(codex, codex.platforms.macos![0]!)).toBe('bun add -g @openai/codex')
    expect(formatInstallMethodCommand(codex, codex.platforms.macos!.find(m => m.type === 'mise')!)).toBe(
      'mise use --global npm:@openai/codex',
    )
    expect(formatInstallMethodCommand(codex, codex.platforms.macos!.find(m => m.type === 'brew')!)).toBe(
      'brew install codex',
    )
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
