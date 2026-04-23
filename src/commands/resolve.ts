import type { CommandResult } from '../output/types'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { resolveAgentInspection } from '../services/agents'
import { pc } from '../utils/color'
import { formatInstallMethodCommand, formatInstallMethodLabel } from '../utils/install'

interface ResolveCommandData {
  agent: {
    binaryName: string
    displayName: string
    name: string
  }
  resolution: {
    binaryPath: string
    installGuidance?: {
      docsRef: string
      installMethods: Array<{
        command: string
        label: string
        type: string
      }>
      suggestedAction: 'ensure-agent-installed'
      suggestedEnsureCommand: string
    }
    installed: boolean
    installSource: string
    installedVersion?: string
    lifecycle: 'managed' | 'unmanaged'
    sourceLabel: string
    suggestedLaunchCommand: string[]
  }
}

export async function resolveCommand(agentName: string): Promise<CommandResult<ResolveCommandData>> {
  const resolved = await resolveAgentInspection(agentName)
  if (!resolved) {
    return emitCommandResult(createErrorResult<ResolveCommandData>({
      action: 'resolve',
      error: {
        code: 'AGENT_NOT_FOUND',
        details: {
          input: agentName,
        },
        message: `Unknown agent: ${agentName}`,
      },
      target: {
        kind: 'agent',
        name: agentName,
      },
    }), renderResolveHuman)
  }

  const { agent, inspection } = resolved
  if (!inspection.inPath || !inspection.binaryPath) {
    const installMethods = inspection.methods.map(method => ({
      command: formatInstallMethodCommand(agent, method),
      label: formatInstallMethodLabel(method),
      type: method.type,
    })).filter(method => method.command)

    return emitCommandResult(createErrorResult<ResolveCommandData>({
      action: 'resolve',
      data: {
        agent: {
          binaryName: agent.binaryName,
          displayName: agent.displayName,
          name: agent.name,
        },
        resolution: {
          binaryPath: '',
          installGuidance: {
            docsRef: 'skills/quantex-cli/references/command-recipes.md',
            installMethods,
            suggestedAction: 'ensure-agent-installed',
            suggestedEnsureCommand: `quantex ensure ${agent.name}`,
          },
          installed: false,
          installSource: 'not-installed',
          lifecycle: 'unmanaged',
          sourceLabel: 'not installed',
          suggestedLaunchCommand: [],
        },
      },
      error: {
        code: 'AGENT_NOT_INSTALLED',
        details: {
          docsRef: 'skills/quantex-cli/references/command-recipes.md',
          installMethods,
          suggestedAction: 'ensure-agent-installed',
          suggestedEnsureCommand: `quantex ensure ${agent.name}`,
        },
        message: `${agent.displayName} is not installed.`,
      },
      target: {
        kind: 'agent',
        name: agent.name,
      },
    }), renderResolveHuman)
  }

  return emitCommandResult(createSuccessResult<ResolveCommandData>({
    action: 'resolve',
    data: {
      agent: {
        binaryName: agent.binaryName,
        displayName: agent.displayName,
        name: agent.name,
      },
      resolution: {
        binaryPath: inspection.binaryPath,
        installed: true,
        installSource: inspection.installedState?.installType ?? 'detected-in-path',
        installedVersion: inspection.installedVersion,
        lifecycle: inspection.lifecycle,
        sourceLabel: inspection.sourceLabel,
        suggestedLaunchCommand: [inspection.binaryPath],
      },
    },
    target: {
      kind: 'agent',
      name: agent.name,
    },
  }), renderResolveHuman)
}

function renderResolveHuman(result: { data?: ResolveCommandData, error: { message: string } | null }): void {
  if (result.error) {
    console.log(pc.red(result.error.message))
    const guidance = result.data?.resolution.installGuidance
    if (guidance) {
      console.log(pc.dim(`Try: ${guidance.suggestedEnsureCommand}`))
      for (const method of guidance.installMethods)
        console.log(pc.dim(`Install: [${method.label}] ${method.command}`))
    }
    return
  }

  if (!result.data)
    return

  console.log(pc.bold(`\n${result.data.agent.displayName}\n`))
  console.log(`  Name:         ${result.data.agent.name}`)
  console.log(`  Binary:       ${result.data.agent.binaryName}`)
  console.log(`  Path:         ${result.data.resolution.binaryPath}`)
  console.log(`  Source:       ${result.data.resolution.sourceLabel}`)
  console.log(`  Lifecycle:    ${result.data.resolution.lifecycle}`)
  console.log(`  Install Type: ${result.data.resolution.installSource}`)
  if (result.data.resolution.installedVersion)
    console.log(`  Version:      ${result.data.resolution.installedVersion}`)
  console.log(`  Launch:       ${result.data.resolution.suggestedLaunchCommand.join(' ')}`)
  console.log()
}
